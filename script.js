const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const newHero = \    <section class="page-section pt-32 pb-24" data-purpose="hero-section">
      <div class="container mx-auto px-5 lg:px-6">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div class="flex flex-col items-start text-right">
            <span class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f4f7fb] text-brand-blue text-sm font-bold border border-slate-100 mb-6 shadow-sm">
              <i class="fa-solid fa-check-circle"></i>
              «·„‰’… «·√Ê·Ï ·· ÊŸÌ› «·–ﬂÌ ›Ì „’—
            </span>
            <h1 class="text-4xl md:text-5xl lg:text-7xl font-black text-slate-900 leading-[1.2] mb-6">
              „” ﬁ»·ﬂ «·„Â‰Ì Ì»œ√ <span class="text-[#005dac]">»ŒÿÊ… Ê«Õœ…</span>
            </h1>
            <p class="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl leading-relaxed">
              ‰Õ‰ ‰—»ÿ «·ﬂ›«¡«  «·ÿ„ÊÕ… »√›÷· ›—’ «·⁄„· ›Ì «·”Êﬁ «·„Õ·Ì° »√”·Ê» ⁄’—Ì ÌÕ —„ Œ’Ê’Ì ﬂ ÊÌœ⁄„ „”Ì— ﬂ.
            </p>
            <div class="flex flex-wrap items-center gap-4 w-full">
              <a class="bg-[#005dac] text-white px-8 py-4 rounded-xl text-lg font-bold flex items-center gap-3 transition-transform hover:-translate-y-1 shadow-lg hover:shadow-brand-blue/30 magnetic-shell" href="jobs.html">
                 ’›Õ «·ÊŸ«∆› <i class="fa-solid fa-briefcase"></i>
              </a>
              <a class="bg-white text-slate-700 bg-opacity-70 px-8 py-4 rounded-xl text-lg font-bold flex items-center gap-3 transition-transform hover:-translate-y-1 border border-slate-200 magnetic-shell" href="#about">
                «ﬂ ‘› «·„“Ìœ
              </a>
            </div>
            <div class="mt-12 w-full max-w-xl">
              <div class="home-search-card bg-white/70 backdrop-blur-xl p-3 rounded-2xl shadow-lg border border-slate-100 flex flex-col md:flex-row gap-3 relative z-10 transition-shadow hover:shadow-xl">
                <div class="home-search-card__field flex-1 flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-sm border border-slate-100">
                  <span class="text-[#005dac]"><i class="fa-solid fa-briefcase"></i></span>
                  <input class="bg-transparent border-none outline-none w-full text-slate-800" data-home-keyword placeholder="«·„”„Ï «·ÊŸÌ›Ì √Ê «·‘—ﬂ…" type="text"/>
                </div>
                <div class="home-search-card__field flex-1 flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-sm border border-slate-100">
                  <span class="text-[#005dac]"><i class="fa-solid fa-location-dot"></i></span>
                  <select class="bg-transparent border-none outline-none w-full text-slate-800" data-home-governorate></select>
                </div>
                <button class="bg-[#005dac] text-white px-7 py-3 rounded-xl font-bold hover:bg-opacity-90 transition-transform hover:-translate-y-0.5" data-search-action="home" type="button">»ÕÀ</button>
              </div>
            </div>
            <div class="page-card page-card--inline hidden mt-4 border-emerald-100 bg-emerald-50" data-company-only hidden>
              <div>
                <strong class="text-emerald-800">·ÊÕ… «·‘—ﬂ…</strong>
                <p class="text-emerald-700 text-sm">≈œ«—… «·ÊŸ«∆› Ê«·ÿ·»«  „‰ ‰›” «·„‰’….</p>
              </div>
              <a class="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm" href="company-dashboard.html">«› Õ «··ÊÕ…</a>
            </div>
          </div>
          <div class="relative flex justify-center lg:justify-end items-center py-10">
            <div class="absolute inset-0 bg-[#005dac]/10 blur-3xl rounded-[4rem] scale-105 pointer-events-none"></div>
            <article class="relative bg-white/70 backdrop-blur-2xl border border-white/50 p-14 rounded-[3.5rem] shadow-2xl w-[90%] max-w-md aspect-square flex items-center justify-center">
              <img alt="‘⁄«— «·—Õ„… «·„Âœ«Â ·· ÊŸÌ›" src="logo-mark.png" class="w-full h-auto object-contain drop-shadow-xl" />
            </article>
          </div>
        </div>
        
        <div class="home-live-strip mt-16 lg:mt-24 grid grid-cols-1 md:grid-cols-3 gap-6" aria-label="≈Õ’«∆Ì«  Ê ‘€Ì· «·„‰’…">
          <article class="home-live-card magnetic-shell bg-white/60 backdrop-blur-xl border border-slate-100 rounded-3xl p-8 flex flex-col items-center text-center shadow-lg transition-transform hover:-translate-y-1">
            <span class="text-4xl lg:text-5xl font-black text-[#005dac] mb-2 drop-shadow-sm" data-home-live-stat="jobs" data-countup>0</span>
            <span class="text-slate-600 font-bold mb-1">«·ÊŸ«∆› «·„⁄—Ê÷…</span>
            <p class="text-xs text-slate-400">⁄œœ «·ÊŸ«∆› «·„⁄ „œ… Ê«·„› ÊÕ….</p>
          </article>
          
          <article class="home-live-card magnetic-shell bg-white/60 backdrop-blur-xl border border-slate-100 rounded-3xl p-8 flex flex-col items-center text-center shadow-lg transition-transform hover:-translate-y-1">
            <span class="text-4xl lg:text-5xl font-black text-[#005dac] mb-2 drop-shadow-sm" data-home-live-stat="companies" data-countup>0</span>
            <span class="text-slate-600 font-bold mb-1">«·‘—ﬂ«  «·‰‘ÿ…</span>
            <p class="text-xs text-slate-400">«·‘—ﬂ«  «·„⁄ „œ… ·· ÊŸÌ›.</p>
          </article>
          
          <article class="home-live-card bg-gradient-to-br from-[#005dac] to-[#004a80] rounded-3xl p-8 flex flex-col justify-center text-white shadow-xl shadow-brand-blue/20">
            <h3 class="text-xl font-black mb-3">—Õ· ﬂ Ê«÷Õ…</h3>
            <ol class="step-list text-blue-100 text-sm space-y-2 pr-4 list-decimal marker:font-bold marker:text-white">
              <li>«»ÕÀ ⁄‰ «·ÊŸÌ›… «·„‰«”»….</li>
              <li>√ﬂ„· «· ﬁœÌ„ »”ÂÊ·….</li>
              <li>«Õ ›Ÿ »—ﬁ„ «·ÿ·» ··„ «»⁄….</li>
            </ol>
          </article>
        </div>
      </div>
    </section>\;
html = html.replace(/<section class="product-hero" data-purpose="hero-section">[\s\S]*?<\/section>/, newHero);
fs.writeFileSync('index.html', html);
