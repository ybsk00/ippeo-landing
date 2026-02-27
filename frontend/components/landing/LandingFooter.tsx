import { type Dict } from "@/lib/i18n";

interface Props {
  t: Dict;
}

export default function LandingFooter({ t }: Props) {
  return (
    <footer className="bg-white border-t border-[#FADBE9] pt-16 pb-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4 lg:gap-16">
          {/* Company info */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 text-[#2D1A25] mb-6">
              <div className="size-8 bg-[#FF66CC]/10 rounded-lg flex items-center justify-center text-[#FF66CC]">
                <span className="material-symbols-outlined text-2xl">auto_awesome</span>
              </div>
              <h2 className="text-xl font-black">IPPEO</h2>
            </div>
            <p className="max-w-md text-[#6B4A5C] text-sm leading-relaxed">
              {t.footer_desc}
            </p>
          </div>

          {/* Service links */}
          <div>
            <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-[#2D1A25]">
              {t.footer_service}
            </h3>
            <ul className="flex flex-col gap-4 text-sm">
              <li><a className="text-[#6B4A5C] hover:text-[#FF66CC] transition-colors" href="#">{t.footer_service_1}</a></li>
              <li><a className="text-[#6B4A5C] hover:text-[#FF66CC] transition-colors" href="#">{t.footer_service_2}</a></li>
              <li><a className="text-[#6B4A5C] hover:text-[#FF66CC] transition-colors" href="#">{t.footer_service_3}</a></li>
              <li><a className="text-[#6B4A5C] hover:text-[#FF66CC] transition-colors" href="#">{t.footer_service_4}</a></li>
            </ul>
          </div>

          {/* Support links */}
          <div>
            <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-[#2D1A25]">
              {t.footer_support}
            </h3>
            <ul className="flex flex-col gap-4 text-sm">
              <li><a className="text-[#6B4A5C] hover:text-[#FF66CC] transition-colors" href="#faq">{t.footer_support_1}</a></li>
              <li><a className="text-[#6B4A5C] hover:text-[#FF66CC] transition-colors" href="#">{t.footer_support_2}</a></li>
              <li><a className="text-[#6B4A5C] hover:text-[#FF66CC] transition-colors" href="#">{t.footer_support_3}</a></li>
              <li><a className="text-[#6B4A5C] hover:text-[#FF66CC] transition-colors" href="#">{t.footer_support_4}</a></li>
            </ul>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-10 pt-6 border-t border-[#FADBE9]">
          <p className="text-xs text-[#6B4A5C]/70 leading-relaxed">{t.footer_disclaimer}</p>
        </div>

        {/* Copyright */}
        <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-[#6B4A5C]/50">{t.footer_copyright}</p>
        </div>
      </div>
    </footer>
  );
}
