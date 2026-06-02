const fs = require('fs');

const cssContent = fs.readFileSync('src/style.css', 'utf-8') + `
/* New Visual Storytelling CSS */
.hero-video-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.hero-video-bg iframe {
  width: 200vw;
  height: 200vh;
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) scale(1.1);
  opacity: 0.35;
  filter: saturate(1.4) brightness(0.7);
}
@media (max-width: 768px) {
  .hero-video-bg iframe { display: none; }
  .hero-video-bg { 
    background: radial-gradient(circle at 50% 50%, rgba(20, 20, 20, 0.4), rgba(0, 0, 0, 0.8)),
                linear-gradient(45deg, rgba(232, 115, 10, 0.3), rgba(13, 148, 136, 0.3));
  }
}

.gallery-masonry {
  columns: 4 240px;
  column-gap: 1rem;
}
.gallery-masonry img {
  width: 100%;
  break-inside: avoid;
  margin-bottom: 1rem;
  border-radius: 0.75rem;
  object-fit: cover;
  transition: transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 400ms ease;
}
.gallery-masonry img:hover {
  transform: scale(1.03);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  z-index: 2;
  position: relative;
}

.video-frame {
  position: relative;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  max-width: 900px;
  margin-inline: auto;
  aspect-ratio: 16/9;
  cursor: pointer;
}
.video-poster { width: 100%; height: 100%; object-fit: cover; }
.play-btn {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) scale(1);
  transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  background: none; border: none;
}
.video-frame:hover .play-btn { transform: translate(-50%, -50%) scale(1.15); }

.section-bg-photo {
  position: absolute; inset: 0; z-index: 0;
  overflow: hidden;
}
.section-bg-photo img {
  width: 100%; height: 100%; object-fit: cover;
  filter: brightness(0.35) saturate(1.5);
  will-change: transform;
  transform: translateY(var(--parallax-offset, 0px));
}

.testimonial-card {
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 1rem;
  color: white;
}

.guide-section-photo {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  filter: brightness(0.4) saturate(0.8);
  mix-blend-mode: multiply;
  border-radius: 1rem;
}

/* Animations Library */
.img-blur-up { filter: blur(20px); transition: filter 600ms ease; }
.img-blur-up.loaded { filter: blur(0); }

.img-reveal { clip-path: inset(0 100% 0 0); transition: clip-path 800ms cubic-bezier(0.16, 1, 0.3, 1); }
.img-reveal.visible { clip-path: inset(0 0% 0 0); }

.img-zoom-wrap { overflow: hidden; border-radius: 1rem; }
.img-zoom-wrap img { transition: transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1); width: 100%; height: 100%; object-fit: cover; }
.img-zoom-wrap:hover img { transform: scale(1.08); }

@keyframes kenBurns {
  0%, 100% { transform: scale(1) translate(0, 0); }
  33%  { transform: scale(1.06) translate(-1.5%, -1%); }
  66%  { transform: scale(1.04) translate(1%, 1.5%); }
}
.img-ken-burns { animation: kenBurns 12s ease-in-out infinite; }
.step-photo { animation: kenBurns 8s ease-in-out infinite; object-fit: cover; border-radius: 9999px; }

.img-tilt { transition: transform 150ms ease; }
`;

fs.writeFileSync('src/style.css', cssContent);

