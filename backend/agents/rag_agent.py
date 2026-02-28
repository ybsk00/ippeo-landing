import asyncio
import logging

from services.gemini_client import get_query_embedding
from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)


async def search_relevant_faq(
    keywords: list[str],
    category: str,
    match_threshold: float = 0.65,
    match_count: int = 8,
    latest_message: str = None,
) -> list[dict]:
    """벡터 검색. latest_message가 있으면 듀얼 검색 (포커스 + 컨텍스트) 후 병합."""
    db = get_supabase()

    query_text = " ".join(keywords) if keywords else ""

    # 임베딩 생성 — 두 쿼리를 병렬로
    has_focus = bool(latest_message and latest_message.strip())
    has_context = bool(query_text.strip())

    if has_focus and has_context:
        focus_emb, context_emb = await asyncio.gather(
            get_query_embedding(latest_message),
            get_query_embedding(query_text),
        )
    elif has_focus:
        focus_emb = await get_query_embedding(latest_message)
        context_emb = None
    elif has_context:
        focus_emb = None
        context_emb = await get_query_embedding(query_text)
    else:
        return []

    # DB 검색 — 병렬
    search_tasks = []
    search_labels = []

    if focus_emb:
        search_tasks.append(
            asyncio.to_thread(
                lambda emb=focus_emb: db.rpc("search_faq", {
                    "query_embedding": emb,
                    "target_category": category,
                    "match_threshold": match_threshold,
                    "match_count": match_count,
                }).execute()
            )
        )
        search_labels.append("focus")

    if context_emb:
        search_tasks.append(
            asyncio.to_thread(
                lambda emb=context_emb: db.rpc("search_faq", {
                    "query_embedding": emb,
                    "target_category": category,
                    "match_threshold": match_threshold,
                    "match_count": match_count,
                }).execute()
            )
        )
        search_labels.append("context")

    search_results = await asyncio.gather(*search_tasks)

    # 결과 병합 — 포커스 검색 결과 우선
    seen_ids = set()
    merged = []
    for label, result in zip(search_labels, search_results):
        if result.data:
            for faq in result.data:
                faq_id = faq["id"]
                if faq_id not in seen_ids:
                    seen_ids.add(faq_id)
                    merged.append(faq)
            logger.info(f"[RAG] {label} search: {len(result.data)} results")

    # similarity 순으로 정렬, 상위 match_count개만
    merged.sort(key=lambda x: x.get("similarity", 0), reverse=True)
    merged = merged[:match_count]

    if not merged:
        return []

    # RPC 결과에 youtube_title, youtube_video_id가 없을 수 있으므로
    # id 목록으로 추가 정보 조회
    faq_ids = [faq["id"] for faq in merged]
    extra_result = db.table("faq_vectors").select(
        "id, youtube_title, youtube_video_id, youtube_url"
    ).in_("id", faq_ids).execute()

    extra_map = {}
    if extra_result.data:
        for row in extra_result.data:
            extra_map[row["id"]] = row

    # source_type 태깅: PubMed vs YouTube 구분
    tagged_results = []
    for faq in merged:
        faq_id = faq["id"]
        extra = extra_map.get(faq_id, {})

        # RPC에 없는 필드를 추가 조회에서 병합
        if "youtube_title" not in faq:
            faq["youtube_title"] = extra.get("youtube_title", "")
        if "youtube_video_id" not in faq:
            faq["youtube_video_id"] = extra.get("youtube_video_id", "")

        url = faq.get("youtube_url", "") or ""
        if "pubmed.ncbi.nlm.nih.gov" in url:
            faq["source_type"] = "pubmed"
            faq["paper_title"] = faq.get("youtube_title", "")
            faq["pmid"] = faq.get("youtube_video_id", "")
        else:
            faq["source_type"] = "youtube"
        tagged_results.append(faq)

    return tagged_results
