import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ARUMI 상담 리포트";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://ippeo-landing-1016411135464.asia-northeast3.run.app/api";

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let title = "美容相談リポート";
  let description = "韓国美容医療の専門カウンセリング";
  let isKorean = false;

  try {
    const res = await fetch(`${API_BASE}/public/report/${token}`, {
      next: { revalidate: 600 },
    });

    if (res.ok) {
      const data = await res.json();
      const reportData = data.report_data;
      const inputLang = data.input_language || "ja";
      isKorean = inputLang === "ko";

      if (reportData?.title) {
        title = reportData.title;
      } else if (data.customer_name) {
        title = isKorean
          ? `${data.customer_name}님 상담 리포트`
          : `${data.customer_name}様 ご相談リポート`;
      }

      if (reportData?.section1_key_summary?.points?.length) {
        description = reportData.section1_key_summary.points[0];
        if (description.length > 60) {
          description = description.substring(0, 57) + "...";
        }
      } else {
        description = isKorean
          ? "한국 미용의료 전문 상담 분석 리포트"
          : "韓国美容医療の専門カウンセリング";
      }
    }
  } catch {
    // fallback to defaults
  }

  const tagline = isKorean
    ? "AI 맞춤 상담 분석 리포트"
    : "AI カウンセリング分析リポート";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #FFF5F3 0%, #FFE8E2 30%, #F5D5CC 60%, #E8927C 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background decorative circles */}
        <div
          style={{
            position: "absolute",
            top: "-80px",
            right: "-80px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "rgba(232, 146, 124, 0.15)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-60px",
            left: "-60px",
            width: "250px",
            height: "250px",
            borderRadius: "50%",
            background: "rgba(232, 146, 124, 0.1)",
            display: "flex",
          }}
        />

        {/* Main card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 255, 255, 0.92)",
            borderRadius: "32px",
            padding: "50px 70px",
            maxWidth: "1000px",
            boxShadow: "0 8px 40px rgba(232, 146, 124, 0.2)",
          }}
        >
          {/* Logo area */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #E8927C, #D4756A)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "24px",
                fontWeight: 700,
              }}
            >
              A
            </div>
            <span
              style={{
                fontSize: "32px",
                fontWeight: 700,
                color: "#E8927C",
                letterSpacing: "3px",
              }}
            >
              ARUMI
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "18px",
              color: "#B8897E",
              marginBottom: "30px",
              letterSpacing: "1px",
              display: "flex",
            }}
          >
            {tagline}
          </div>

          {/* Divider */}
          <div
            style={{
              width: "60px",
              height: "3px",
              background: "linear-gradient(90deg, #E8927C, #F5B8A8)",
              borderRadius: "2px",
              marginBottom: "30px",
              display: "flex",
            }}
          />

          {/* Title */}
          <div
            style={{
              fontSize: "38px",
              fontWeight: 700,
              color: "#2C3E50",
              textAlign: "center",
              lineHeight: 1.3,
              marginBottom: "16px",
              display: "flex",
            }}
          >
            {title}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: "20px",
              color: "#7F8C8D",
              textAlign: "center",
              lineHeight: 1.5,
              display: "flex",
            }}
          >
            {description}
          </div>
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              fontSize: "16px",
              color: "rgba(232, 146, 124, 0.7)",
              letterSpacing: "2px",
            }}
          >
            arumi-landing.web.app
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
