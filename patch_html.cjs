const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// 1. Head meta tags
const metaTags = `    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23E8730A'/%3E%3Cpath d='M16 6 C11 6 7 10 7 15 C7 21 16 28 16 28 C16 28 25 21 25 15 C25 10 21 6 16 6Z' fill='white'/%3E%3Ccircle cx='16' cy='15' r='4' fill='%23E8730A'/%3E%3C/svg%3E">
    <meta property="og:title" content="LayoverLocal — Mumbai in a Few Hours">
    <meta property="og:description" content="Get a personalised Mumbai tour with a vetted local student during your airport layover. Explore the real city in just a few hours.">
    <meta property="og:image" content="https://source.unsplash.com/featured/1200x630?mumbai,night,city">
    <meta property="og:url" content="https://layoverlocal.com">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="https://source.unsplash.com/featured/1200x630?mumbai,gateway-of-india">
    <title>Mumbai Layover Buddies | Authentic City Tours</title>`;

html = html.replace('<title>Mumbai Layover Buddies | Authentic City Tours</title>', metaTags);

// 2. Hero Background Video
const heroBg = `<div class="hero-video-bg">
  <iframe
    src="https://www.youtube.com/embed/rDTNVd3TLPU?autoplay=1&mute=1&loop=1&playlist=rDTNVd3TLPU&controls=0&disablekb=1&modestbranding=1&playsinline=1"
    frameborder="0"
    allow="autoplay; encrypted-media"
    allowfullscreen
    title="Mumbai city timelapse background"
    loading="lazy"
  ></iframe>
</div>
        <div class="absolute inset-0 z-[-1]">`;

html = html.replace('<div class="absolute inset-0 z-[-1]">', heroBg);

// 3. Trust Bar Strip
const trustBar = `<div class="mt-8 pt-6 border-t border-slate-200 fade-up-delay-3 flex flex-col md:flex-row items-center justify-center lg:justify-start gap-4">
                    <div class="recent-travelers inline-flex -space-x-2">
                      <img src="https://i.pravatar.cc/40?img=20" alt="Recent traveler" width="40" height="40" loading="lazy" class="rounded-full border-2 border-white shadow-sm">
                      <img src="https://i.pravatar.cc/40?img=21" alt="Recent traveler" width="40" height="40" loading="lazy" class="rounded-full border-2 border-white shadow-sm">
                      <img src="https://i.pravatar.cc/40?img=22" alt="Recent traveler" width="40" height="40" loading="lazy" class="rounded-full border-2 border-white shadow-sm">
                      <img src="https://i.pravatar.cc/40?img=33" alt="Recent traveler" width="40" height="40" loading="lazy" class="rounded-full border-2 border-white shadow-sm">
                      <img src="https://i.pravatar.cc/40?img=44" alt="Recent traveler" width="40" height="40" loading="lazy" class="rounded-full border-2 border-white shadow-sm">
                    </div>
                    <span class="recent-label text-sm font-medium text-slate-600">+2,400 travelers hosted this year</span>
                </div>`;

html = html.replace(/<div class="mt-8 pt-6 border-t border-slate-200 fade-up-delay-3 flex items-center justify-center lg:justify-start gap-4">[\s\S]*?<\/div>\s*<\/div>/, trustBar);

// 4. Update 'How It Works' photos
html = html.replace('<div class="flex-1 text-center bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/40 border border-slate-100 transform transition duration-300 hover:-translate-y-2">', `<div class="flex-1 text-center bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/40 border border-slate-100 transform transition duration-300 hover:-translate-y-2 relative overflow-hidden"><img src="https://source.unsplash.com/featured/120x80?airplane,airport,travel" class="step-photo absolute top-4 right-4 w-16 h-12 shadow-sm" alt="">`);
html = html.replace('<div class="flex-1 text-center bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/40 border border-slate-100 transform transition duration-300 hover:-translate-y-2">', `<div class="flex-1 text-center bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/40 border border-slate-100 transform transition duration-300 hover:-translate-y-2 relative overflow-hidden"><img src="https://source.unsplash.com/featured/120x80?student,guide,india" class="step-photo absolute top-4 right-4 w-16 h-12 shadow-sm" alt="">`);
html = html.replace('<div class="flex-1 text-center bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/40 border border-slate-100 transform transition duration-300 hover:-translate-y-2">', `<div class="flex-1 text-center bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/40 border border-slate-100 transform transition duration-300 hover:-translate-y-2 relative overflow-hidden"><img src="https://source.unsplash.com/featured/120x80?mumbai,street" class="step-photo absolute top-4 right-4 w-16 h-12 shadow-sm" alt="">`);

// 5. Replace Gallery Grid with Experience Packages Grid AND Masonry Gallery AND Video Reel
const experiencePackages = `
    <!-- Experience Packages -->
    <div class="py-4 pb-16">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="grid md:grid-cols-3 gap-6">
                <!-- Quick Escape -->
                <div class="img-zoom-wrap photo-card rounded-[2rem] h-72 shadow-2xl shadow-slate-300/30 border border-white/70 relative">
                    <img src="https://source.unsplash.com/featured/600x200?marine-drive,mumbai,night" alt="Marine Drive Mumbai at night — Quick Escape tour" class="img-blur-up w-full h-full object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-teal-900/80 to-transparent flex items-end p-6">
                        <h3 class="text-white font-bold text-xl">Quick Escape</h3>
                    </div>
                </div>
                <!-- The Real Mumbai -->
                <div class="img-zoom-wrap photo-card rounded-[2rem] h-72 shadow-2xl shadow-slate-300/30 border border-white/70 relative">
                    <img src="https://source.unsplash.com/featured/600x200?dharavi,mumbai,colourful" alt="Dharavi Mumbai — The Real Mumbai tour" class="img-blur-up w-full h-full object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-amber-900/80 to-transparent flex items-end p-6">
                        <h3 class="text-white font-bold text-xl">The Real Mumbai</h3>
                    </div>
                </div>
                <!-- Deep Dive -->
                <div class="img-zoom-wrap photo-card rounded-[2rem] h-72 shadow-2xl shadow-slate-300/30 border border-white/70 relative">
                    <img src="https://source.unsplash.com/featured/600x200?juhu-beach,mumbai,sunset" alt="Juhu Beach Mumbai sunset — Deep Dive tour" class="img-blur-up w-full h-full object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-orange-900/80 to-transparent flex items-end p-6">
                        <h3 class="text-white font-bold text-xl">Deep Dive</h3>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Mumbai Through Their Lens -->
    <div class="py-16 lg:py-24 bg-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-12">
                <h2 class="text-3xl font-extrabold text-gray-950 sm:text-4xl">Mumbai, As Seen By Those Who Live It</h2>
                <p class="mt-4 text-lg text-slate-600">Every photo taken by a LayoverLocal guide. Real people. Real moments.</p>
            </div>
            <div class="gallery-masonry">
                <img class="img-reveal img-blur-up" src="https://source.unsplash.com/featured/400x500?chai,india,street-food" alt="Cutting chai Mumbai street" width="400" height="500" loading="lazy">
                <img class="img-reveal img-blur-up" src="https://source.unsplash.com/featured/400x300?gateway-of-india,mumbai" alt="Gateway of India Mumbai" width="400" height="300" loading="lazy" style="transition-delay: 100ms">
                <img class="img-reveal img-blur-up" src="https://source.unsplash.com/featured/400x600?dharavi,community,india" alt="Dharavi Mumbai vibrant community" width="400" height="600" loading="lazy" style="transition-delay: 200ms">
                <img class="img-reveal img-blur-up" src="https://source.unsplash.com/featured/400x400?railway-station,india,heritage" alt="CST railway station Mumbai heritage architecture" width="400" height="400" loading="lazy" style="transition-delay: 300ms">
                <img class="img-reveal img-blur-up" src="https://source.unsplash.com/featured/400x350?street-food,india,snack" alt="Vada pav Mumbai street food" width="400" height="350" loading="lazy" style="transition-delay: 100ms">
                <img class="img-reveal img-blur-up" src="https://source.unsplash.com/featured/400x550?bridge,mumbai,dusk" alt="Bandra Worli Sea Link at dusk" width="400" height="550" loading="lazy" style="transition-delay: 200ms">
                <img class="img-reveal img-blur-up" src="https://source.unsplash.com/featured/400x400?young-people,india,smiling,students" alt="Students in Mumbai smiling" width="400" height="400" loading="lazy" style="transition-delay: 300ms">
                <img class="img-reveal img-blur-up" src="https://source.unsplash.com/featured/400x300?train,india,window,travel" alt="View from Mumbai local train" width="400" height="300" loading="lazy">
            </div>
        </div>
    </div>

    <!-- See The Experience -->
    <section class="video-reel py-16 lg:py-24 text-center">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="video-reel__label text-indigo-600 font-bold tracking-wider uppercase text-sm mb-2 block">60 Seconds in Mumbai</div>
            <h2 class="text-3xl font-extrabold text-gray-950 mb-4">This is what your layover could feel like</h2>
            <p class="text-slate-600 mb-10">Watch Arjun take Emma from Denmark through 5 hours of real Mumbai</p>

            <div class="video-frame">
                <!-- Poster image shown before play -->
                <img 
                class="video-poster"
                src="https://source.unsplash.com/featured/1200x675?mumbai,travel,people"
                alt="Watch a LayoverLocal experience video"
                width="1200" height="675" loading="lazy"
                >
                <!-- Play button overlay -->
                <button class="play-btn" aria-label="Play experience video">
                <svg viewBox="0 0 60 60" width="60" height="60">
                    <circle cx="30" cy="30" r="30" fill="#4f46e5" opacity="0.9"/>
                    <polygon points="23,18 47,30 23,42" fill="white"/>
                </svg>
                </button>
            </div>
        </div>
    </section>
`;

html = html.replace(/<!-- Gallery Grid -->[\s\S]*?<!-- How It Works -->/, experiencePackages + '\n\n    <!-- How It Works -->');

// 6. Testimonials Parallax
const oldReviews = /<div id="reviews" class="py-16 lg:py-24 bg-slate-50 relative">[\s\S]*?<div class="absolute top-0 right-0 w-64 h-64 bg-indigo-100\/50 rounded-full blur-3xl rounded-full"><\/div>/;
const newReviews = `<section id="reviews" class="testimonials py-16 lg:py-24 relative">
  <div class="section-bg-photo" aria-hidden="true">
    <img
      src="https://source.unsplash.com/featured/1920x800?mumbai,sunset,golden-hour,city"
      alt="" width="1920" height="800" loading="lazy" decoding="async" class="img-blur-up"
    >
  </div>`;

html = html.replace(oldReviews, newReviews);
html = html.replace(/<h2 class="text-3xl font-extrabold text-gray-950">/g, '<h2 class="text-3xl font-extrabold text-white">'); // Fix header color in testimonials

html = html.replace(/<div class="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">/g, '<div class="testimonial-card p-8 rounded-3xl shadow-sm">');
html = html.replace(/<p class="text-slate-700 italic mb-6">/g, '<p class="text-slate-100 italic mb-6">');
html = html.replace(/<p class="font-bold text-slate-900 text-sm">/g, '<p class="font-bold text-white text-sm">');
html = html.replace(/<p class="text-slate-500 text-xs">/g, '<p class="text-indigo-200 text-xs">');

html = html.replace('<!-- FAQ -->', '</section>\n\n    <!-- FAQ -->'); // close section

// 7. Scripts 
const scripts = `<script>
document.querySelectorAll('img.img-blur-up').forEach(img => {
  if (img.complete) img.classList.add('loaded');
  else img.addEventListener('load', () => img.classList.add('loaded'));
});

const bgPhoto = document.querySelector('.section-bg-photo img');
if (bgPhoto) {
    window.addEventListener('scroll', () => {
    const rect = bgPhoto.closest('.testimonials').getBoundingClientRect();
    const offset = rect.top * 0.3;
    bgPhoto.style.setProperty('--parallax-offset', \`\${offset}px\`);
    }, { passive: true });
}

const videoFrame = document.querySelector('.video-frame');
if (videoFrame) {
    videoFrame.addEventListener('click', function() {
        this.innerHTML = \`
            <iframe
            width="100%" height="100%"
            src="https://www.youtube.com/embed/rDTNVd3TLPU?autoplay=1&rel=0"
            frameborder="0"
            allow="autoplay; encrypted-media; fullscreen"
            allowfullscreen
            style="position:absolute;inset:0;"
            ></iframe>\`;
    });
}

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });
document.querySelectorAll('.img-reveal').forEach(el => observer.observe(el));
</script>
</body>`;

html = html.replace('</body>', scripts);

fs.writeFileSync('index.html', html, 'utf-8');

