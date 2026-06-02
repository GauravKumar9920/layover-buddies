# Detour Design System (legacy "City of Dreams" / saffron)

> ⚠️ **Superseded — visual reskin pending.** This documents the older saffron-led "City of Dreams" palette used by the current app/marketing code. The brand has since moved to **Detour** with the cartographic "Deviation Line" identity. For the current direction see `detour-design-philosophy.md`, `detour-logo.html`, and `detour-logo-system.png`. This file is retained until the phased visual reskin lands.

**Version:** 1.0  
**Last Updated:** April 2026  
**Purpose:** Comprehensive visual and interaction framework for a mobile-first app connecting international travelers with local student guides in Mumbai.

**Design Philosophy:** Beauty + Animation + Intuitive Interactions. Every pixel and motion should feel deliberate, warm, and alive—like Mumbai itself.

---

## 1. Brand Identity

### 1.1 Color Palette

#### Primary Colors
| Color | Hex | Usage | Psychology |
|-------|-----|-------|------------|
| **Mumbai Saffron** | #F97316 | Primary CTA, trusted elements, headers | Trust, reliability, ocean vibes |
| **Bougainvillea Pink** | #EC4899 | Energy elements, alerts, secondary CTA | Energy, warmth, Mumbai sunset |
| **Warm Cream** | #FFFAF5 | Backgrounds, breathable space | Clean, premium, minimalist |
| **Midnight Navy** | #0B1229 | Primary text, sophisticated elements | Professional, readable, depth |

#### Extended Palette
| Color | Hex | Usage |
|-------|-----|-------|
| Teal Light | #E8F5F5 | Background tints, hover states, highlights |
| Teal Dark | #EA580C | Pressed states, dark headers, depth |
| Coral Light | #FFE8E8 | Badge backgrounds, notification halos |
| Coral Dark | #BE185D | Error states, SOS button, critical alerts |
| Gold | #F59E0B | Star ratings, premium badges, highlights |
| Success Green | #27AE60 | Confirmations, positive states, verified badges |
| Warning Amber | #F39C12 | Warnings, attention needed, pending states |
| Mumbai Purple | #6C5CE7 | Premium features, special events, accent highlights |

#### Gradient Library (Use EVERYWHERE for visual richness)

**Hero Gradient** (for splashes, headers, large CTAs)
```css
background: linear-gradient(135deg, #F97316 0%, #EA580C 50%, #0B1229 100%);
```
*Creates depth from teal through dark charcoal*

**Sunset Gradient** (for warm, energetic elements)
```css
background: linear-gradient(135deg, #EC4899 0%, #F59E0B 100%);
```
*Evokes Mumbai's golden-hour sunsets*

**Card Shimmer** (loading/skeleton effect)
```css
background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%);
```
*Sweeps left-to-right smoothly over content*

**Glass Effect** (modern, frosted glass aesthetic)
```css
background: rgba(255,255,255,0.15);
backdrop-filter: blur(20px);
border: 1px solid rgba(255,255,255,0.2);
```
*Works over any background; use for tab bars, floating sheets*

**Mumbai Glow** (for premium/special elements)
```css
background: linear-gradient(135deg, #6C5CE7 0%, #F97316 100%);
box-shadow: 0 0 30px rgba(108, 92, 231, 0.3);
```

### 1.2 Typography System

#### Font Families

| Family | Usage | Characteristics | Download |
|--------|-------|-----------------|----------|
| **Plus Jakarta Sans** | Headings (H1–H3), Logo | Modern, geometric, warm, approachable | Google Fonts |
| **Inter** | Body text, UI labels, long-form | Excellent on-screen readability, modern, neutral | Google Fonts |
| **DM Sans** | Numbers, prices, stats, captions | Clean, distinctive, perfect for data | Google Fonts |

#### Type Scale

All values in pixels, with recommended line-height and letter-spacing:

| Name | Size | Line Height | Letter Spacing | Weight | Usage |
|------|------|-------------|-----------------|--------|-------|
| **H1** | 48 | 1.2 (58px) | -0.02em | 700 (Bold) | Page titles, hero text |
| **H2** | 40 | 1.25 (50px) | -0.01em | 700 (Bold) | Section headers |
| **H3** | 32 | 1.3 (42px) | 0 | 600 (SemiBold) | Subsection headers |
| **H4** | 28 | 1.35 (38px) | 0 | 600 (SemiBold) | Card titles |
| **Body Large** | 18 | 1.5 (27px) | 0 | 400 (Regular) | Lead paragraphs, important text |
| **Body** | 16 | 1.6 (26px) | 0 | 400 (Regular) | Primary body text, descriptions |
| **Body Small** | 14 | 1.6 (22px) | 0 | 400 (Regular) | Secondary text, metadata |
| **Caption** | 12 | 1.5 (18px) | 0 | 500 (Medium) | Timestamps, labels, footnotes |
| **Number (Large)** | 24 | 1.2 | 0 | 700 (Bold) | Prices, big stats |
| **Number (Regular)** | 16 | 1.2 | 0 | 600 (SemiBold) | Ratings, counts, data |

#### Typography Rules for Implementation

1. **Headings always use Plus Jakarta Sans** with increased letter-spacing for presence
2. **Body text always uses Inter** for consistent readability across device sizes
3. **Numbers always use DM Sans** (monospace-ish feel) for prices and stats
4. **Never mix serif and sans-serif** in same section
5. **Color hierarchy**: 
   - Primary text: Midnight Navy (#0B1229) — 100% opacity
   - Secondary text: Midnight Navy at 60% opacity
   - Tertiary text: Midnight Navy at 45% opacity
   - Interactive text: Mumbai Saffron (#F97316) or Bougainvillea Pink (#EC4899)

---

## 2. Animation System (THE SOUL OF THE APP)

The animation system is non-negotiable. Every interaction should feel responsive and alive. Animations run at 60fps minimum and should never feel janky or delayed.

### 2.1 Animation Tokens & Timing

**Standard Easings:**
- **Spring (iOS-like feel):** `damping: 15, stiffness: 150, mass: 1` — for bouncy, organic feedback
- **Ease Out:** `cubic-bezier(0.4, 0, 0.2, 1)` — natural deceleration
- **Ease In-Out:** `cubic-bezier(0.42, 0, 0.58, 1)` — smooth start and end
- **Ease Linear:** `linear` — for continuous rotations, progress bars

**Duration Guidelines:**
- Micro-interactions (button press): 150–200ms
- Page transitions: 250–400ms
- Scroll animations: 300–600ms
- Modals/sheets: 350–450ms
- Loading states: 1500–2000ms (cycling)

### 2.2 Micro-Interactions (Every Tap Should Feel Alive)

#### Button Press Animation
**Interaction:** User taps any primary button
```
State: default
Scale: 1.0
Shadow: shadow-md (0 4px 6px rgba(0,0,0,0.1))

State: onPress
Scale: 0.96
Shadow: shadow-sm (0 1px 3px rgba(0,0,0,0.08))
Transition: 60ms instant

State: onRelease
Scale: 1.0 (spring physics)
Shadow: shadow-md (spring return)
Duration: 250ms spring with damping: 15, stiffness: 150
```

**Visual Result:** Button "depresses" like a physical button, bounces back with satisfying spring.

#### Card Tap & Lift
**Interaction:** User taps any card (guide card, itinerary, review)
```
State: idle
Transform: translateY(0) scale(1.0)
Shadow: shadow-lg (0 10px 25px rgba(0,0,0,0.1))

State: onPress
Transform: translateY(-2px) scale(0.98)
Shadow: shadow-md (reduce slightly)
Duration: 100ms ease-out

State: hover (if applicable)
Transform: translateY(-4px) scale(1.0)
Shadow: shadow-xl (0 20px 35px rgba(0,0,0,0.15))
Duration: 300ms spring

State: release
Transform: returns to hover state smoothly
```

**Visual Result:** Cards feel pressable, lift away slightly on hover, spring back with depth.

#### Like/Heart Burst Animation
**Interaction:** User taps heart icon (for guide, trip, review)
```
Phase 1: Scale burst (0ms–200ms)
Heart icon: scale(0) → scale(1.2) → scale(1.0)
Duration: 200ms spring (damping: 12, stiffness: 200)

Phase 2: Confetti (50ms–800ms, starts during phase 1)
5–8 particles burst outward from heart center
Each particle: random angle (360°), speed 400–600px/s
Fade out from 100% opacity to 0% over 600ms
Gravity effect: slight downward acceleration

Phase 3: Color fill
Heart outline fills with Coral (#EC4899)
Duration: 150ms ease-in

Haptic: Light tap + medium impact on release
```

**Visual Result:** Tapping heart creates a satisfying explosion of color and particles.

#### Toggle/Switch Animation
**Interaction:** User taps a toggle or boolean switch
```
State: off
Position: left (0%)
Background: Light gray (opacity 30%)
Thumb color: Warm Cream
Duration to reach: instant (on render)

State: on (after tap)
Position: right (100%)
Background: Mumbai Saffron (#F97316)
Thumb color: White with teal shadow

Transition: 200ms ease-out
Easing: cubic-bezier(0.4, 0, 0.2, 1)

Haptic: Selection haptic (light vibration)
```

**Visual Result:** Switch glides smoothly with color change; feels responsive and weighty.

#### Pull-to-Refresh (Custom Mumbai Skyline)
**Interaction:** User drags down from top of list to refresh

```
State: idle (pull amount = 0px)
Indicator: Off-screen above
Pull distance threshold: 80px

At 0–50px pull:
Mumbai skyline illustration animates building-by-building
Buildings rise at y position relative to pull distance
Opacity increases as buildings appear

At 50–80px pull:
All buildings are visible
Text appears: "Release to refresh"
Icon rotates and becomes colorful (gradient)

On release (pull >= 80px):
Buildings complete final animation (all full height)
Spinner appears in center
API call initiates
On success: check mark animation, buildings settle with glow
Duration for full cycle: 1.5–2s

If released early (< 80px):
Buildings animate back down off-screen
Snap back with spring physics
```

**Visual Result:** Custom pull-to-refresh that celebrates Mumbai culture, not generic spinner.

#### Skeleton Loading Shimmer
**Interaction:** Content loads (guide cards, reviews, images)
```
Layout: Bone-shaped placeholder boxes matching real content
- Guide card skeleton: large rectangle (hero), circular avatar, rectangular bars for text
- Review skeleton: circular avatar, 2 text bars, star row
- Image skeleton: rounded rectangle matching aspect ratio

Animation: Shimmer sweep
Gradient (left to right): transparent → rgba(white, 0.3) → transparent
Duration: 1.5s, repeat infinite
Delay stagger: parent container stagger each skeleton child by 50ms

On content load:
Fade out skeleton (300ms ease)
Fade in real content (300ms ease, 100ms delay)
Never sudden pop-in
```

**Visual Result:** Beautiful loading state that outlines content before it appears.

### 2.3 Page Transitions

#### Navigation Push (Forward)
**Trigger:** Tapping a navigation button or card leading forward

```
Incoming screen:
From state: offscreen right (translateX: 100%)
To state: onscreen center (translateX: 0)
Duration: 300ms
Easing: spring physics (damping: 15, stiffness: 150)
Content fade-in: opacity 0 → 1 over 200ms (staggered 100ms)

Outgoing screen:
Stays visible underneath but dims
Opacity: 100% → 85% (creates depth effect)
Scale: 1.0 → 0.98 (parallax effect)
Duration: 300ms

Haptic: None (feels natural)
```

**Visual Result:** Incoming screen slides in from right with spring bounce, previous screen dims behind.

#### Navigation Pop (Back)
**Trigger:** Tapping back button or swiping right edge

```
Incoming screen (returning):
From state: dimmed (opacity: 85%, scale: 0.98)
To state: normal (opacity: 100%, scale: 1.0)
Duration: 250ms ease-in-out
Outgoing screen:
From state: onscreen (translateX: 0)
To state: offscreen right (translateX: 100%)
Duration: 250ms ease-in-out
Content fade-out: opacity 1 → 0 over 150ms (staggered 50ms)
Haptic: None
```

**Visual Result:** Screen slides out to right, previous screen recovers from dimmed state.

#### Modal Bottom-Up
**Trigger:** Opening confirmation dialog, filter menu, or action sheet

```
Modal appearance:
From state: below screen (translateY: 100% + 40px)
To state: centered or at bottom (translateY: 0)
Duration: 400ms
Easing: spring physics (damping: 14, stiffness: 170) — slightly bouncier than push

Background overlay:
From state: opacity 0
To state: opacity 1 (dark overlay, typically rgba(0,0,0,0.5))
Duration: 300ms ease-out

Handle bar:
Animates from opacity 0 → 1 over 200ms (appears at top)

Content:
Staggered fade-in: each element fades in at 100ms intervals
```

**Visual Result:** Modal springs up from bottom with satisfying bounce, everything dims behind it.

#### Bottom Sheet Drag Behavior
**Trigger:** Opening bottom sheet with 3 snap points (peek 25%, half 50%, full 90%)

```
Drag detection:
Pan gesture tracks vertical movement
Real-time translation as user drags (no delay)

Snap points:
Peek: 25% of screen height (expand preview)
Half: 50% of screen height (main interaction)
Full: 90% of screen height (detailed view)

Physics on release:
Velocity-based snap: calculate release velocity
If velocity > 200px/s, snap to next point in direction
If velocity < 200px/s, snap to nearest point
Spring to final position: damping: 12, stiffness: 180

While dragging:
Background overlay opacity increases with drag progress
At peek: 20% opacity
At half: 40% opacity
At full: 50% opacity

Content scrolling:
Enable internal scroll only after reaching half snap point
Prevents scroll conflicts while dragging sheet up
```

**Visual Result:** Intuitive, momentum-aware sheet behavior that feels native and responsive.

### 2.4 Scroll Animations

#### Parallax Header (Hero Image)
**Setup:** Full-width image at top of scrollable content

```
Hero image scroll speed: 0.5x (scroll at half speed of content)
Text content scroll speed: 1x (normal scroll)
Effect: Image stays longer as you scroll, creating depth

Implementation:
onScroll listener:
imageTranslateY = -scrollOffset * 0.5
textTranslateY = -scrollOffset * 1.0

As user scrolls 100px down:
Image moves 50px down (stays more visible)
Text moves 100px down (scrolls normally)

Stop scrolling: When image reaches minimum visible height (e.g., 60px header)
Use max(0, imageTranslateY) to prevent over-scroll
```

**Visual Result:** Majestic hero image that lags behind content as you scroll.

#### Fade-in on Scroll (Staggered Entry)
**Setup:** Content elements fade in + translate as they enter viewport

```
Each element:
Initial state: opacity 0, translateY(20px) — positioned 20px lower
As element enters viewport (bottom 30% of screen):
Animation: fade in (opacity 0 → 1) + rise (translateY(20px) → 0)
Duration: 500ms ease-out
Start delay: calculated per element index
Stagger amount: 100ms per element (element 0: 0ms, element 1: 100ms, etc.)

Implementation:
Track scroll position
For each element, check if bottomEdge(element) > topEdge(viewport)
If true AND not yet animated, trigger animation with index-based delay

Result: Elements appear to rise into view as you scroll
```

**Visual Result:** Content gracefully appears as you scroll, each element in sequence.

#### Sticky Header with Shrink & Blur
**Setup:** Search bar or title that shrinks as user scrolls

```
Initial state (at top):
Height: 120px
Blur: 0px
Background: solid (Warm Cream)
Title opacity: 100%, large font

As user scrolls down (after hero):
Height: 120px → 60px (linear over 200px scroll)
Blur: 0 → 20px (ease-out)
Background: transition to glass effect (rgba + blur)
Title opacity: 100% → 70% (fade slightly)
Font size: gradually reduces

At scroll threshold (sticky point):
Height: 60px (final)
Blur: 20px (full effect)
Stays fixed at top

On scroll back up:
Reverse all animations smoothly
Expand back to 120px
Remove blur
Restore opacity

Implementation:
scrollOffset > heroHeight ? activate sticky mode
Animate all properties in real-time based on scroll delta
```

**Visual Result:** Header elegantly compresses and blurs as you scroll, modern and polished.

#### Card Reveal on Scroll (Staggered Slide)
**Setup:** List of cards (guides, trips, reviews) that animate in

```
Initial state (before entering viewport):
Opacity: 0
translateY: 40px (positioned 40px down, off-screen)
Scale: 0.95 (slightly smaller)

Trigger: Card bottom edge enters viewport
Animation:
Fade in: opacity 0 → 1
Rise: translateY(40px) → 0
Scale: 0.95 → 1.0
Duration: 600ms spring physics (damping: 14, stiffness: 140)

Stagger: Each card in list gets delay = index * 100ms
So first card reveals immediately, second at 100ms, etc.

For infinite scroll:
New cards entering already have stagger applied
Duration: 1500ms total per card (fade: 600ms + wait: 900ms)
```

**Visual Result:** List items gracefully pop into view, each with its own entrance timing.

### 2.5 Loading States

#### Skeleton Screens (Preferred over Spinners)
**Design:** Use bone-shaped placeholders matching actual content

```
Guide Card Skeleton:
[████████████████████] ← 16:9 ratio placeholder
        [⚫]           ← avatar circle
[███████████]          ← name bar
[██████] [██████]      ← language tags
[███████] [███████]    ← skill tags
[█████] ← From ₹2,000  ← price

Animation:
Shimmer gradient sweeps left-to-right: 1.5s infinite
Easing: linear
Start point: -100% (off-screen left)
End point: 100% (off-screen right)
Opacity of shimmer: 40% (subtle)

Review Card Skeleton:
[⚫] [███████]         ← avatar + name
[★★★★★]               ← stars
[███████████] 
[███████]              ← text lines

On content load:
Fade skeleton out: opacity 1 → 0 (300ms ease-in)
Fade content in: opacity 0 → 1 (300ms ease-out, 100ms delay)
Never sudden replacement
```

**Visual Result:** Beautiful placeholder that shows content structure before loading.

#### Image Loading: Blur-Up Technique
**Setup:** Every image loads in two stages

```
Stage 1: Low-resolution blur (blurhash)
Load tiny (10-30 bytes) blurhash placeholder
Display at full size with blur(20px)
Fade in immediately
Users see a blurry preview instantly

Stage 2: High-resolution image
Load actual image in background
Once loaded, crossfade to sharp version
Fade out blur: opacity 1 → 0
Fade in sharp: opacity 0 → 1
Duration: 300ms ease-out
Result: Smooth transition from blur to clarity

Implementation:
Use expo-image library (better than React Native Image)
Generate blurhash on backend
Pass as placeholder
Automatically handles transition
```

**Visual Result:** Images appear instantly (blurry), then sharpen into view.

#### Content Loaded Animation
**Trigger:** Content successfully loads and displays

```
Container animation:
Subtle fade-in: opacity 0 → 1 over 300ms ease-out
Slight lift: translateY(10px) → 0 over 300ms ease-out
(Both happen simultaneously)

Never pop-in abruptly; always fade and move.

Internal animations (staggered):
Each content section fades in with small delays:
Section 1: 0ms
Section 2: 100ms
Section 3: 200ms
...continuing

Result: Content gradually materializes rather than appearing all at once
```

**Visual Result:** Content feels like it's being revealed gracefully.

#### Button Loading State
**Interaction:** User taps submit/CTA button, async operation begins

```
Initial state: Button ready
Text visible: "Request Buddy" or "Confirm Booking"

On button press:
Text fades out: opacity 1 → 0 (100ms)
Circular spinner animates in: scale 0 → 1 (150ms spring)
Spinner appears in center of button
Button remains same dimensions (no layout shift)
Spinner color: white (if coral button), or teal (if white button)
Spinner rotation: 360° infinite, 1.2s linear

Duration: Spinner animates until API returns

On success:
Spinner fades out (200ms ease)
Checkmark animates in (SVG draw, 400ms)
Button background flashes to Success Green briefly
Text appears below button: "All set!"

On error:
Spinner fades out (200ms ease)
Button shakes: 3 quick horizontal shakes, 200ms total
Error message appears: "Something went wrong"
Text appears below button: "Try again"

Result: User always knows status of their action
```

**Visual Result:** Transforma clear feedback for async operations.

### 2.6 Celebration Animations (Key Moments)

#### Booking Confirmed
**Trigger:** Traveler successfully books a guide tour

```
Full-screen celebration:
Background gradient animates colors
From: Mumbai Saffron → Bougainvillea Pink → Mumbai Purple
Duration: 2s loop, soft transitions

Confetti burst (Lottie animation):
Particles burst from screen center outward
5–10 colorful confetti pieces (brand colors)
Animate for 2.5s, slow fade-out at end
Repeat animation once (0.5s delay before repeat)

Checkmark animation (SVG path draw):
Large checkmark (centered, 80px size)
Draws itself: stroke animation from 0% → 100%
Stroke color: Success Green (#27AE60)
Glow effect: box-shadow pulses 2x (200ms each)
Duration: 400ms

Text animation:
"You're all set!" scales in with bounce
Scale: 0 → 1.2 → 1.0
Duration: 500ms spring
Haptic feedback: success pattern (short-long-short vibrations)

Booking details card:
Slides up from bottom after checkmark completes (200ms delay)
Card contains: guide name, date, time, total price
Animation: slideUp 400ms spring

Timeline:
0ms: Background gradient starts, confetti begins
100ms: Checkmark starts drawing
600ms: "You're all set!" appears
900ms: Booking card slides up
2500ms: Confetti fades out, but celebration stays on screen

Duration before auto-dismiss: 3s (then fade-out and navigate)
```

**Visual Result:** Joyful, memorable celebration that makes booking feel exciting.

#### 5-Star Review Received
**Trigger:** Guide or traveler receives a perfect review

```
Stars animate in sequence:
Initial state: Stars offline-screen (above)
Each star slides down and rotates 360°

Star 1: Appears, rotates, scale 0 → 1.2 → 1.0 (200ms spring)
Star 2: Delay 100ms, same animation
Star 3: Delay 200ms, same animation
Star 4: Delay 300ms, same animation
Star 5: Delay 400ms, same animation

Golden glow effect:
After all 5 stars appear, they collectively glow
Glow animation: box-shadow pulses
Intensity: 0 → 100% → 0
Duration: 1s, repeat 2x

Text "Amazing!" appears after all stars:
Scale in with bounce: 0 → 1.3 → 1.0
Duration: 300ms spring
Delay: 600ms (after star 5)

Confetti burst (smaller than booking):
3–5 gold-colored confetti pieces
Duration: 1.5s

Sound/Haptic: Light success haptic
```

**Visual Result:** Stars cascade down in a shower of gold and accomplishment.

#### Invite Code Earned
**Trigger:** Traveler earns referral reward code

```
Gift box animation (Lottie):
Box animates on screen (scale 0 → 1 with bounce)
Duration: 500ms spring
Lid opens (rotates off box)
Confetti explodes upward from inside box
Duration: 2s
Text appears: "You've earned a code!"

Code reveal:
After confetti, card animates up from bottom
Contains: Code (large, monospace, bright teal background)
Copy button glows (subtle pulse)
Subtext: "Share with friends to get ₹500 off!"

Timeline:
0ms: Box scales in
500ms: Box lid opens
700ms: Confetti explodes
2700ms: Code card slides up
3000ms: Copy button pulses (attract attention)

Haptic: Success pattern
```

**Visual Result:** Rewarding moment that feels like winning something.

#### Tour Completed
**Trigger:** Guide marks tour as complete

```
Fireworks animation (Lottie):
Full-screen burst of colorful particles
Colors cycle through brand palette (teal, coral, gold, purple)
Center burst with downward rain effect
Duration: 2s

Badge animation:
"Amazing!" achievement badge flies in from top-right
Rotates as it falls to center
Scale bounces: 0 → 1.3 → 1.0
Duration: 600ms spring

Text:
"Tour complete!" fades in (opacity 0 → 1, 300ms)
Subtitle: "Rate this buddy ⭐"

Action prompt:
Rating stars appear (empty, ready to tap)
Tapping stars triggers individual fills with glow

Timeline:
0ms: Fireworks start
200ms: Badge enters
800ms: Text and rating prompt appear
2000ms: Fireworks fade out, keep rating visible
```

**Visual Result:** Celebratory send-off that prompts review.

#### First Payout
**Trigger:** Guide receives their first payment

```
Money rain animation (Lottie):
Stylized ₹ symbols fall from top
Subtle, celebratory (not excessive)
Colors: Gold and green (money vibes)
Duration: 2.5s

Amount animation:
Large rupee amount appears in center
Scales in: 0 → 1.3 → 1.0
Duration: 500ms spring
Text below: "Payment confirmed!"

Celebration elements:
2–3 confetti bursts (gold/green themed)
Background gradient shifts to warm tones
Haptic: Success pattern with longer vibration

Timeline:
0ms: Money rain starts
200ms: Amount appears
1000ms: Confetti bursts
2500ms: Everything fades to normal state

Auto-dismiss: 4s, then fade and return to dashboard
```

**Visual Result:** Financial milestone feels special and rewarding.

### 2.7 Gesture Interactions

#### Swipe Guide Cards (Tinder-like)
**Interaction:** User swipes left/right on guide profile cards

```
Card positioning:
Horizontal pan gesture tracks finger movement (real-time)
Card follows finger: translateX = panX

Rotation (slight tilt):
As user swipes, card rotates slightly based on distance
Rotation angle = panX * 0.05 (subtle, not exaggerated)
This creates the "throwing" sensation

Velocity detection on release:
Calculate swipe velocity from gesture speed
If abs(velocity) > 300px/s:
Snap card off-screen in swipe direction
Animate next card into place below (spring up)
If velocity < 300px/s:
Spring card back to center (x=0, rotation=0)

Feedback:
As card moves left (reject):
Opacity of card: 100% → 60% (fades)
Red tint appears (Coral Dark color)
Text "Pass" appears and fades in above card

As card moves right (accept):
Opacity: stays 100%
Green tint appears (Success Green)
Text "Like" appears and fades in above card

Haptic:
Light tap when card is dismissed (satisfied feedback)
Light tap when card bounces back (friendly rejection)

Spring physics for bounce-back:
Damping: 12, stiffness: 180 (feels snappy)

Result: Card animates off-screen smoothly, next card replaces it
```

**Visual Result:** Engaging, familiar swipe mechanic that feels natural.

#### Drag Bottom Sheet (3 Snap Points)
**Interaction:** User drags bottom sheet to peek, half, or full height

**Already detailed in section 2.3, but key points:**
- Real-time translation as user drags (no delay)
- Visual feedback: background overlay opacity increases with drag
- Smart snap: velocity-aware snapping to nearest point
- Scroll interaction only after reaching half snap point (prevents conflicts)

#### Pinch to Zoom (Gallery)
**Interaction:** User pinches image to zoom

```
Initial state:
Image at 1x scale, centered

Pinch gesture:
Track two-finger touch points
Calculate distance between fingers
Scale calculation: newScale = 1.0 + (pinchDelta / 200)
Clamp scale: min 1.0, max 3.0
Apply in real-time as fingers move

Momentum on release:
Calculate pinch velocity
If velocity > threshold, continue scaling briefly
Spring to final snapped scale (1x, 2x, or 3x)
Duration: 200ms spring

When zoomed:
Image is pannable (drag to move around within bounds)
Prevent dragging beyond image edges

Gesture end:
If scale < 1.2, spring back to 1x
If 1.2 <= scale < 2.5, snap to 2x
If scale >= 2.5, snap to 3x

Haptic:
Light tap when scale changes across thresholds (0.5 intervals)
```

**Visual Result:** Smooth zoom experience for examining photos.

#### Long Press (Reveal Actions)
**Interaction:** User long-presses a card or element

```
Recognition:
Finger held on element for 300ms
During hold time:
Scale: 1.0 → 1.05 (subtle grow)
Haptic: Light tap after 300ms (confirms recognition)

After press recognized:
Menu appears (context menu or action sheet)
Options: Save, Share, Report, etc.
Menu animates in: scales from touch point (spring up)
Duration: 200ms spring

Background:
Slight dim (opacity shift)
Content slightly blurs (if text)

Cancellation:
If user releases before 300ms, nothing happens
If user releases after 300ms, menu appeared
Tap elsewhere to dismiss menu (spring out animation)

Result: Helpful actions revealed without cluttering interface
```

**Visual Result:** Intuitive way to access secondary actions.

---

## 3. Component Library

### 3.1 Buttons

#### Primary Button (Coral CTA)
**Style Guidelines:**
```
Default state:
Background: Sunset Gradient (linear-gradient(135deg, #EC4899 0%, #F59E0B 100%))
Text: White, Inter 16px Bold
Padding: 12px horizontal, 16px vertical (total 48px height)
Border radius: 9999px (fully rounded pill shape)
Box shadow: 0 4px 12px rgba(255, 107, 107, 0.25)

Hover state:
Background: Slightly brighter (lighten 8%)
Shadow: 0 6px 16px rgba(255, 107, 107, 0.3)
Scale: 1.02 (subtle grow)
Duration: 200ms ease-out

Pressed state:
Scale: 0.96 (compress)
Shadow: 0 2px 6px rgba(255, 107, 107, 0.15)
Background: Darker by 5%
Duration: 100ms instant

Disabled state:
Opacity: 0.5
Pointer events: none
No shadow

Loading state:
Text fades out: opacity 1 → 0 (100ms)
Circular spinner appears (24px diameter)
Spinner color: white
Duration: Until API response

Success state (optional):
Background: Success Green (#27AE60)
Icon: Checkmark (white)
Duration: 1.5s, then auto-dismiss
```

**Size variants:**
- **Small (sm):** 36px height, 14px text, 10px padding
- **Medium (md):** 48px height, 16px text, 12px padding (DEFAULT)
- **Large (lg):** 56px height, 18px text, 14px padding

**Code example (React Native):**
```javascript
<TouchableOpacity
  style={{
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 9999,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  }}
  activeOpacity={0.96}
  onPress={handlePress}
>
  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
    {loading ? <ActivityIndicator /> : 'Request Buddy'}
  </Text>
</TouchableOpacity>
```

#### Secondary Button (Teal Outline)
**Style Guidelines:**
```
Default state:
Background: transparent (or Warm Cream #FFFAF5)
Border: 2px solid Mumbai Saffron (#F97316)
Text: Mumbai Saffron (#F97316), Inter 16px Bold
Padding: 12px horizontal, 14px vertical (accounts for border)
Border radius: 12px (slightly less than primary)
Box shadow: none

Hover state:
Background: Teal Light (#E8F5F5)
Border: 2px solid Mumbai Saffron
Scale: 1.02
Duration: 200ms ease-out

Pressed state:
Background: Teal Dark (#EA580C)
Text color: White
Scale: 0.96
Duration: 100ms instant

Disabled state:
Opacity: 0.4
```

#### Ghost Button (No Background)
**Style Guidelines:**
```
Default state:
Background: transparent
Border: none
Text: Mumbai Saffron (#F97316), Inter 16px Medium
Padding: 12px horizontal, 12px vertical

Pressed state:
Background: Teal Light (#E8F5F5) — 20% opacity
Scale: 0.96
Duration: 150ms ease-out

Useful for: Secondary actions, less emphasis
```

#### SOS/Emergency Button (Red Pulsing)
**Style Guidelines:**
```
Default state:
Background: Coral Dark (#BE185D)
Text: "SOS" or "Emergency", white, 18px bold
Border radius: 9999px
Size: 56px diameter (circular)
Box shadow: 0 0 20px rgba(229, 85, 85, 0.4)

Pulsing animation:
Box shadow pulsates continuously:
Step 1: 0 0 20px rgba(229, 85, 85, 0.4)
Step 2: 0 0 30px rgba(229, 85, 85, 0.6)
Step 3: 0 0 20px rgba(229, 85, 85, 0.4)
Duration: 1.5s infinite ease-in-out

On press:
Scale: 0.94 (slightly compressed)
Modal appears: "Are you safe? Call emergency services?"
Options: Call Emergency / Cancel

Haptic: Heavy impact when tapped (urgent feeling)

Never disappears from screen; always accessible
Position: Fixed at bottom-right of screen (except in modals)
Z-index: Very high, above all other elements except modals
```

#### Floating Action Button (FAB)
**Style Guidelines:**
```
Default state:
Background: Sunset Gradient
Shape: Circle (64px diameter)
Icon: white, 28px size (e.g., +, camera, chat bubble)
Position: Fixed, bottom-right (16px from edges)
Box shadow: 0 8px 16px rgba(0, 0, 0, 0.15)

Mount animation:
Scale: 0 → 1.2 → 1.0
Duration: 400ms spring

Hover state:
Scale: 1.1
Shadow: 0 12px 24px rgba(0, 0, 0, 0.2)
Duration: 250ms spring

Pressed state:
Scale: 0.92
Shadow: 0 4px 8px rgba(0, 0, 0, 0.1)
Duration: 100ms instant

With submenu:
On press, 2–3 secondary FABs expand around primary FAB
Each secondary FAB scales in with staggered delay (100ms each)
Labels appear next to secondary buttons
Tap any option to execute action and collapse menu

Example layout (vertical expansion upward):
          [Share]
          [Edit]
          [Delete]
            [+]  ← Primary FAB
```

### 3.2 Cards

#### Guide Card (The Star of the App)
**Design & Layout:**
```
Structure:
┌─────────────────────────────────┐
│  Hero Image (16:9 ratio)        │ ← 280px width (mobile)
│  [Gradient overlay bottom]      │
├─────────────────────────────────┤
│    [Avatar] ← Overlapping -24px │
│  Name | Rating | Languages      │
│  Skill Tags                      │
│  From ₹2,000/day               │
└─────────────────────────────────┘

Hero Image:
Height: Auto (16:9 aspect ratio)
Gradient overlay (bottom): linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 100%)
Rounded top corners: 16px

Avatar (Profile Picture):
Size: 64px diameter
Border: 3px white
Position: Centered, overlapping image/text boundary (24px up)
Drop shadow: 0 4px 8px rgba(0,0,0,0.15)

Content area:
Padding: 16px
Background: Warm Cream (#FFFAF5)
Rounded bottom corners: 16px

Name & Rating Row:
Name: Plus Jakarta Sans 18px Bold, Midnight Navy
Rating: "⭐ 4.9 (43)" — gold stars, Inter 14px
Below on next row:
Languages: ["English", "Hindi", "Marathi"] as teal pills
Spacing: 8px between pills

Skill Tags:
Colored chips (background colors per category):
- Food 🍜: Orange (#FF9F43)
- History 🏛️: Purple (#6C5CE7)
- Photography 📸: Blue (#0984E3)
- Bollywood 🎬: Pink (#FD79A8)
- Markets 🛍️: Teal (#F97316)
Spacing: 8px between tags
Font: DM Sans 12px

Price:
"From ₹2,000/day" — large, DM Sans 18px bold
Color: Coral (#EC4899)
Position: Bottom-right corner of content area

Card-level styles:
Border radius: 16px
Box shadow: 0 4px 16px rgba(0,0,0,0.1)
Background: Warm Cream

Interactive states:
Hover:
Transform: translateY(-4px) scale(1.0)
Box shadow: 0 12px 32px rgba(0,0,0,0.15)
Duration: 300ms spring

Pressed:
Transform: translateY(-2px) scale(0.98)
Box shadow: 0 6px 16px rgba(0,0,0,0.1)
Duration: 100ms ease-out

Tap action: Navigate to guide full profile

Animation on mount:
Fade in: opacity 0 → 1
Slide up: translateY(40px) → 0
Duration: 500ms spring
```

#### Itinerary Card (Horizontal Scroll)
**Design & Layout:**
```
Container width: 280px (fits in horizontal scroll with padding)
Height: 240px

Structure:
┌──────────────────┐
│  Cover Image     │ ← 16:9 ratio, rounded top
│  [Dark overlay]  │
├──────────────────┤
│  Title           │
│  Duration        │
│  3 stops         │
│  ₹12,000/person  │
└──────────────────┘

Cover Image:
Height: 160px (16:9)
Rounded top: 12px
Dark overlay: linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.6) 100%)

Badge (Top-right corner):
"3 stops" — white text, coral background, rounded 8px
Position: absolute, 12px top, 12px right

Text overlay (bottom-left):
Title: Plus Jakarta Sans 16px bold, white
Duration: Inter 12px, white, opacity 80%
Position: 12px from edges

Content area (below image):
Padding: 12px
Background: Warm Cream

Price badge:
"₹12,000" — DM Sans 18px bold, coral text
Position: bottom-right

Card styles:
Border radius: 12px
Box shadow: 0 4px 12px rgba(0,0,0,0.1)

Interactive:
Tap: scale(0.98) → normal (spring)
Tap action: Navigate to itinerary details

Scroll behavior:
Cards in FlatList horizontal scroll
Snap to nearest card on deceleration
Spacing: 12px between cards
```

#### Booking Card (Trip Status)
**Design & Layout:**
```
Structure:
┌─ Left border (colored) ─┬──────────────────────┐
│ Guide Avatar & Name     │ Status pill           │
│ Date & Time             │ [Confirmed in green]  │
│ Location / Address      │                       │
└─────────────────────────┴──────────────────────┘

Left border:
Width: 4px, positioned left
Color: varies by status
- Confirmed: Success Green (#27AE60)
- Pending: Warning Amber (#F39C12)
- In Progress: Mumbai Saffron (#F97316)
- Completed: Gold (#F59E0B)

Content:
Guide avatar: 48px, rounded, 8px from left
Name: Plus Jakarta Sans 16px bold
Date: Inter 14px, gray
Time: Inter 14px, gray
Location: Inter 12px, gray (second line)

Status pill:
Background: Colored (matches border)
Text: white, Inter 12px bold
Padding: 6px 12px
Border radius: 20px
Position: top-right corner

Interactive:
Tap to expand: Height increases, shows more details
Additional details:
- Guide phone number
- Meeting point
- Special instructions
- Cancel booking button (if applicable)

Animation:
Expand: height animates with ease-out
Content fades in (opacity 0 → 1)
Duration: 300ms

Card styles:
Border radius: 12px
Box shadow: 0 2px 8px rgba(0,0,0,0.08)
Padding: 16px
```

#### Review Card
**Design & Layout:**
```
Structure:
┌────────────────────────────────┐
│  ❝ Opening quote decorative   │
│  "Amazing tour with insights  │
│   about local culture..."      │
│  Closing quote ❞               │
│                                │
│  ⭐⭐⭐⭐⭐ 5 stars           │
│  Traveler Name 🇺🇸            │
│  1 week ago                    │
└────────────────────────────────┘

Opening quote:
Font: Plus Jakarta Sans 40px
Color: Gold (#F59E0B)
Opacity: 40%
Position: top-left, -10px offset

Review text:
Inter 14px, Midnight Navy
Line height: 1.6
Max lines: 3 (expandable "more")

Closing quote:
Same as opening, position bottom-right

Star rating:
5 stars in a row
Each star: Gold (#F59E0B)
Size: 18px

Traveler info:
Avatar: 32px, rounded
Name: Inter 14px bold
Flag emoji: country flag (auto-detected)
Position: 12px from left edge

Timestamp:
Inter 12px, gray
"1 week ago"

On mount animation:
Fade in: opacity 0 → 1
Slide up: translateY(20px) → 0
Duration: 400ms ease-out

Expandable content:
If review > 3 lines, show "More" button
Tap expands card: max-height animation
Duration: 300ms ease-out
All text fades in (staggered)
```

### 3.3 Input Fields

**Design & Layout:**
```
Container height: 48px
Border: 1px solid Mumbai Saffron (#F97316)
Border radius: 12px (rounded-xl)
Padding: 12px horizontal, 12px vertical
Background: Warm Cream (#FFFAF5)
Font: Inter 16px

Placeholder:
Color: Midnight Navy at 40% opacity
Text: descriptive ("Enter destination date...")

Focus state:
Border: 2px solid Mumbai Saffron (#F97316)
Glow: box-shadow 0 0 0 3px rgba(13,115,119,0.15)
Background: white (slight change for contrast)
Duration: 200ms ease-out

Error state:
Border: 2px solid Coral Dark (#BE185D)
Background: Coral Light (#FFE8E8) at 20% opacity
Error message: Inter 12px, Coral Dark, below field
Shake animation: 3 quick horizontal shakes (±8px), 200ms total

Text color (filled):
Midnight Navy (#0B1229)
Cursor color: Mumbai Saffron

With left icon:
Icon: 20px, positioned 12px left
Icon color: Midnight Navy at 60% opacity
Text indentation: 44px (12px icon + 12px padding + 20px icon)

With right icon (action):
Icon: 20px, positioned 12px right
Icon color: Mumbai Saffron (for actionable icons)
Tap: Executes action (e.g., clear field, show password)
Cursor indentation: -44px from right

Floating label:
Initially: Position as placeholder, opacity 40%
On focus: 
  - Scale: 0.85
  - Position: move up 8px
  - Opacity: 100%
  - Color: Mumbai Saffron
Duration: 200ms ease-out

Autocomplete:
Show suggestions in dropdown below field
Animated in: scale 0 → 1, duration 150ms
Highlight on keyboard navigation
Tap to select: field fills, dropdown closes

Disabled state:
Opacity: 0.5
Background: Light gray
Pointer events: none
```

### 3.4 Navigation Systems

#### Bottom Tab Bar
**Design & Layout:**
```
Position: Fixed, bottom of screen
Height: 60px (includes safe area padding)
Background: Glass effect
  - background: rgba(255, 255, 255, 0.95)
  - backdrop-filter: blur(20px)
  - border-top: 1px solid rgba(0, 0, 0, 0.05)

Layout: 4 tabs evenly distributed
- Home / Dashboard
- Trips / Calendar
- Messages / Chat
- Profile / Account

Inactive tab:
Icon: 24px, Midnight Navy at 60% opacity
Label: Inter 10px, Midnight Navy at 60% opacity
Position: Centered in tab area

Active tab:
Icon: 24px, Mumbai Saffron (#F97316)
Label: Inter 10px, Mumbai Saffron
Indicator: Colored dot (4px) below icon
Indicator color: Matches icon (Mumbai Saffron or Coral)
Animation: Icon bounces (scale 1 → 1.15 → 1) when switched
Duration: 300ms spring

Interactive:
Tap: Tab switches, animation triggers
Active state: Persists
Haptic: Light selection haptic on switch

Badge (for notifications):
Red dot (8px) in top-right corner of tab icon
Number badge: White text on coral background, 12px
Position: -2px top, -2px right from icon corner
Example: Red "3" for 3 new messages

Safe area:
Account for notch/island on top devices (if bottom nav used differently)
```

#### Top Header/App Bar
**Design & Layout:**
```
Default state (on hero screens):
Height: 56px
Background: transparent
Border: none
Back button: transparent circle, 44px diameter

Elevated state (after scroll):
Height: 56px (same)
Background: white with shadow (0 2px 8px rgba(0,0,0,0.1))
Back button: teal circle background

Back button:
Icon: Left arrow, 20px, white (on teal background when elevated)
Shape: Circle, 44x44px (full touch target)
Animation on press: Scale 0.96, ripple effect from center
Duration: 150ms spring
Tap action: Pop screen / go back

Title:
Plus Jakarta Sans, 18px bold, Midnight Navy
Position: Center-left (or centered, depending on design)

On scroll transition:
Background: Fades from transparent to white
Duration: smooth (triggered at 20% of hero height scrolled)
Title: Fades in and adjusts position
Opacity transition: 0% → 100%
Duration: 300ms

Right action (context):
Menu button, settings icon, or search icon (20px)
Position: right side, 16px padding
Tap action: Opens menu or feature

Sticky behavior:
Stays fixed at top while scrolling
Z-index: High, but below modals/sheets

Rounded corners:
Top corners: 12px (if extended design)
Bottom corners: 0px (standard)
```

### 3.5 Rating Stars

**Design & Layout:**
```
Display mode (read-only):
5 stars in a row
Star size: 20px (can vary)
Star color: Gold (#F59E0B)
Spacing: 4px between stars
Background: transparent

Display with half-stars (supported):
4.5 stars shown as 4 full + 1 half-filled
Half-fill: Gradient from left (filled gold) to right (outline only)

Interactive mode (tap to rate):
Initial state: 5 outlined stars (gray, 40% opacity)
On tap, each star fills from left-to-right:
- Tap star 1: 1 filled, 4 outline
- Tap star 2: 2 filled, 3 outline
- Tap star 3: 3 filled, 2 outline
- Tap star 4: 4 filled, 1 outline
- Tap star 5: 5 filled (all gold)

Animation per star fill:
Scale: 1.0 → 1.3 → 1.0
Fill color: Gray → Gold
Duration: 150ms spring
Glow: box-shadow pulses (golden glow, 200ms)

On release after rating:
Selected stars stay filled (gold)
Animation: Slight sparkle effect around selected stars
Haptic: Light tap feedback per star
Result: Rating submitted / saved

Submitted state:
Filled stars display readonly
Badge appears: "You rated ⭐5"
Position: Below stars, fade-in animation
```

### 3.6 Tags/Chips

**Design & Layout:**
```
Rounded pill shape:
Border radius: 20px (fully rounded)
Padding: 6px 12px (tight, compact)
Font: Inter 12px medium
Height: 28px (default)

Language chips:
Background: Mumbai Saffron (#F97316)
Text: White
Example: ["English", "Hindi", "Marathi"]

Skill chips:
Background: Category-specific color
Text: white
Examples:
- "Foodie 🍜": Orange (#FF9F43)
- "History 🏛️": Purple (#6C5CE7)
- "Photography 📸": Blue (#0984E3)
- "Bollywood 🎬": Pink (#FD79A8)
- "Markets 🛍️": Teal (#F97316)

Removable chips (input context):
X button inside chip (right side)
Tap X: Chip shrinks and fades out (200ms)
Remaining chips shift left smoothly

Add chip:
"+" icon in a pill shape (same styling)
Tap: Morphs into input field
User types to add new tag
Press Return: Confirms and adds
Press Escape or tap outside: Cancels

Interactive states:
Hover/press: Background lightens by 10%
Scale: 0.96 on press
Duration: 150ms ease-out

Disabled chip:
Opacity: 0.5
Pointer events: none
```

### 3.7 Badges

**Design & Layout:**
```
Verified badge:
Icon: Green circle (#27AE60) with white checkmark (14px)
Size: 20px diameter
Position: Overlapping profile name (usually top-right)
Animation: Subtle pulse (scale 1 → 1.1 → 1, 2s infinite)
Tooltip: "Verified guide"

Fast responder badge:
Icon: Lightning bolt (⚡) in amber circle (#F39C12)
Size: 20px diameter
Color: Amber background, white icon
Tooltip: "Responds within 2 hours"

Top rated badge:
Icon: Gold star (⭐) in circle
Size: 20px diameter
Background: Gold (#F59E0B)
Tooltip: "Top rated guide"

New guide badge:
Icon: Sparkle (✨) or "NEW" text
Size: 20px diameter
Background: Mumbai Purple (#6C5CE7)
Color: White text/icon
Tooltip: "Joined recently"

Premium badge:
Icon: Crown (👑) or "PRO" text
Size: 20px diameter
Background: Gold gradient
Glow effect: box-shadow with gold color
Tooltip: "Premium guide"

Badge animations:
On mount: Scale 0 → 1 with spring (300ms)
Pulse (optional): Continuous subtle pulse (2s infinite)
Hover: Scale 1.1, tooltip appears

Position:
Usually top-right of element (profile name, guide card)
Overlap by 8px for integration
```

### 3.8 Bottom Sheets

**Design & Layout:**
```
Full-screen overlay structure:
Position: fixed, bottom 0
Height: Variable (peek 25%, half 50%, full 90%)
Background: Warm Cream (#FFFAF5)
Border radius: 20px top corners
Z-index: Very high (above all except modals)

Handle bar (at top):
Width: 40px
Height: 4px
Border radius: 2px
Background: Midnight Navy at 20% opacity
Position: Centered, 12px from top
Grabbable indicator (visual feedback)

Content area:
Padding: 16px (left, right, bottom)
Top padding: 20px (below handle)
Scrollable: Enable internal scroll at half snap point
Overflow hidden during drag phase

Snap points:
Peek (25%): Show preview of content
Half (50%): Main interaction area
Full (90%): Full view of all content

Spring physics on snap:
Damping: 12, stiffness: 180
Velocity-aware: Snap direction based on release velocity

Gestures:
Pan gesture: Real-time drag feedback
Velocity detection: abs(velocity) determines snap direction
If velocity > 200px/s: Snap to next point in direction
If velocity < 200px/s: Snap to nearest point

Overlay behavior:
Background opacity increases with sheet height:
At peek: 20% black overlay
At half: 40% black overlay
At full: 50% black overlay
Smooth fade as user drags

Scroll behavior:
Only enable internal scroll after half snap point
Prevents conflicts with drag gesture
Smooth transition: Pull up sheet → reach half → scroll enabled

Closing:
Drag below peek point: Sheet snaps closed and dismisses
Tap outside (overlay): Sheet animates down and closes
Offset down: 200ms ease-out animation

Animation on open:
Sheet slides up from bottom with spring bounce
Duration: 400ms spring (damping: 14, stiffness: 170)
Content fades in (staggered by 50ms per element)
```

### 3.9 Image Gallery

**Design & Layout (Grid):**
```
Profile gallery grid:
2 columns (mobile)
Spacing: 8px between images
Aspect ratio: Square (1:1) for uniform grid

Masonry gallery (explore):
Variable column widths
Heights vary (creates flowing effect)
Spacing: 8px

Image card:
Border radius: 12px
Overflow hidden
Load: Blur-up technique (low-res → high-res)
On tap: Fullscreen overlay

Fullscreen view:
Position: Fixed, full screen
Background: Black (opacity 95%)
Image: Centered, zoomed to fit
Safe area: Account for notch

Zoom and pan:
Double-tap: Zoom to 2x
Pinch: Zoom freely (1x to 3x)
Drag when zoomed: Pan within bounds

Swipe navigation:
Swipe left/right: Previous/next image
Current index indicator: "1 / 8" at top
Swipe ease: Momentum-aware, spring snap

Close button:
X button (top-left or top-right)
Circle background, white icon
Tap or swipe down: Close fullscreen

Shared element transition:
Image expands from grid position to fullscreen
Duration: 300ms ease-out (custom animation)
Creates seamless connection between views

Loading in fullscreen:
Blur-up technique shows placeholder
Full image loads in background
Crossfade transition when ready

Animations:
Grid tap: Image scales 0.98 while other cards fade
Fullscreen entry: Image expands from grid position
Exit: Image shrinks back to grid (reverse animation)
Duration: 300ms cubic-bezier
```

---

## 4. Screen-Specific Design Notes

### 4.1 Welcome Screen

**Visual Hierarchy:**
```
Full screen, portrait orientation
Background: Mumbai sunset cityscape (Gateway of India image)
Gradient overlay: dark-to-transparent (bottom to top)
Bottom safe area: 40px padding

Layers:
1. Background image (parallax particles in background)
2. Dark gradient overlay
3. Logo and tagline (foreground)
4. Action buttons (bottom)
```

**Logo Animation:**
```
Initial state: Scaled to 0, opacity 0
Entrance: Scale 0 → 1 with bounce
Duration: 600ms spring (damping: 10, stiffness: 180)
Position: Center-top (40% down)
Size: 120px diameter
Drop shadow: Subtle glow effect
```

**Tagline Animation (Typewriter Effect):**
```
Text: "Connect. Explore. Belong."
Font: Plus Jakarta Sans, 28px bold, white
Initial state: Opacity 0
Animation:
- Characters appear one by one from left to right
- Each character fade-in + scale (0.8 → 1.0)
- Delay between characters: 50ms
- Total duration: ~200ms (3 characters)
- Repeat after 3s pause

Position: Below logo (20px gap)
Alignment: Centered
```

**Floating Particles (Background):**
```
CSS animated circles (bokeh effect)
Colors: Coral and teal at varying opacity (10–20%)
Sizes: 20–60px diameter
Positioned absolutely at random x, y
Animation:
- Vertical float: moveY (0 → 20px, infinite)
- Opacity pulse: opacity (0.1 → 0.3 → 0.1, 3s infinite)
- Duration varies per particle (3–5s)
- No lag; smooth continuous motion
- Total count: 8–12 particles
```

**Action Buttons:**
```
Two buttons at bottom (stacked):
1. "Explore as Traveler" (Primary Coral)
2. "Become a Guide" (Secondary Teal)

Spacing: 12px between buttons
Padding from bottom: 24px

Animation:
Initially: Positioned off-screen (translateY: 100%)
Entrance (staggered):
- Button 1: Slide up (300ms spring), appears at 0ms
- Button 2: Slide up (300ms spring), appears at 200ms delay
- Both bounce slightly at end (spring physics)

Interactive:
On press: Scale 0.96, tap feedback
Tap action: Navigate to login/signup flow

Accessibility:
Touch targets: 48px minimum height
Labels: Clear, descriptive
```

**Overall Animation Timeline:**
```
0ms: Background image loads, fade in over 300ms
200ms: Particles begin floating (staggered starts)
300ms: Logo scales in with bounce
900ms: Tagline starts typewriter effect
1100ms: Button 1 slides up
1300ms: Button 2 slides up
2000ms: All animations complete, interactive
```

### 4.2 Guide Browse (Traveler Home)

**Layout Structure:**
```
Top section:
- Search bar (sticky on scroll)
- Filter chips row (horizontal scroll)

Middle section:
- Guide cards in vertical scroll (infinite)
- Each card has staggered fade-in animation

Bottom section:
- Safe area spacing (60px for bottom nav)
```

**Search Bar:**
```
Position: Sticky (stays at top when scrolling)
Height: 48px
Style: 
  - Background: Warm Cream with subtle shadow
  - Border: 1px solid Teal Light
  - Rounded corners: 12px
  - Padding: 12px left, 12px right
  - Left icon: Search icon (teal, 20px)
  - Placeholder: "Find a guide..."

Animation:
On scroll down:
- Background: Fades to white
- Shadow: Increases (0.1 → 0.15)
- Duration: 200ms smooth

On focus:
- Glow: Blue ring (box-shadow)
- Border: Mumbai Saffron
- Duration: 200ms ease-out
```

**Filter Chips (Horizontal Scroll):**
```
Layout: FlatList horizontal
Padding: 12px (left, right, between chips)
Chips:
- "All" (first chip, always visible)
- "Foodie 🍜", "History 🏛️", "Photography 📸", "Bollywood 🎬", "Adventure 🏔️"

Inactive chip:
- Background: Teal Light (#E8F5F5)
- Text: Midnight Navy
- Border radius: 20px

Active chip:
- Background: Mumbai Saffron
- Text: White
- Animation: Scale 1.02, shadow increase
- Duration: 200ms ease-out

Tap behavior:
- Filter guides list by category
- List animates out/in (crossfade 200ms)
- Reset to top of list
```

**Guide Cards (Vertical Scroll):**
```
Layout: FlashList (not FlatList for performance)
Spacing: 12px between cards
Padding: 12px (left, right, bottom)

Animation on load:
Each card: Fade in + slide up
Initial: opacity 0, translateY(40px)
Final: opacity 1, translateY(0)
Duration: 500ms spring
Delay: index * 100ms (staggered)

Intersection observer:
As card enters viewport (bottom 30%), animation triggers
Prevents animating off-screen cards

Pull-to-refresh:
Trigger: Drag down from top > 80px
Animation: Mumbai skyline animation (buildings rise)
On complete: Guides list refreshes, new cards fade in

Empty state:
If no guides match filters:
- Illustration: Binoculars looking at empty horizon
- Text: "No guides available for this date"
- Subtext: "Try adjusting your filters or date"
- Button: "Clear filters" (animated)
- Animation: Fade in + scale (0.8 → 1.0) over 400ms
```

### 4.3 Guide Profile (Full Screen)

**Scroll Layout:**
```
Header section:
- Parallax hero image
- Profile avatar (overlapping)
- Guide name, university, verified badge

Info section:
- Stats (animated counters)
- Languages
- Skills

Content sections:
- Horizontal itinerary cards
- Photo gallery grid
- Reviews section (expandable)

Action button:
- Sticky "Request This Buddy" button at bottom
- Glass effect background
- Always visible (sticky)
```

**Hero Image & Parallax:**
```
Height: 300px (at top)
Width: Full screen
Aspect ratio: Custom (tall, not 16:9)
Gradient overlay: Dark at bottom (same as card)
Parallax effect:
- Image scroll speed: 0.5x
- Content scroll speed: 1x
- As user scrolls down 100px, image moves 50px down (stays visible longer)

Image loading:
Blur-up technique (low-res placeholder)
Crossfade to sharp image (300ms)
```

**Profile Avatar & Name:**
```
Avatar:
- Size: 80px diameter
- Position: Overlapping hero/content (absolute, -40px from boundary)
- Border: 3px white
- Shadow: 0 4px 12px rgba(0,0,0,0.2)

Name:
- Plus Jakarta Sans, 28px bold
- Position: Below avatar
- Verified badge: Green circle overlapping name (top-right)

Sub-info:
- "NSIT Delhi | 4th Year"
- Inter 14px, gray

```

**Stats Row (Animated Counters):**
```
Display 3 stats horizontally:
1. Tours Completed (e.g., "47")
2. Avg Rating (e.g., "4.9")
3. Languages (e.g., "3")

Animation on scroll (when stat row enters viewport):
Each number counts up from 0 to final value
Duration: 800ms ease-out (easeInOutExpo style)
Counter format: Use integer transitions

Example:
0 → 1 → 5 → 15 → 32 → 47 (over 800ms)
Plus haptic feedback (light tap when reaches final value)

Layout:
- Evenly spaced (33% width each)
- Centered vertically and horizontally
- Stat label below number (smaller text)
- Separator lines between stats (subtle gray)
```

**Itinerary Cards (Horizontal Scroll):**
```
Same as component library section 3.2
Layout: Horizontal FlatList
Padding: 12px
Snap to nearest card (momentum detection)
Each card: 280px width
```

**Photo Gallery Grid:**
```
2-column grid, square aspect ratio
Spacing: 8px
Masonry-like layout (varies by image)

On tap:
Fullscreen overlay with shared element transition
Image expands from grid position to fullscreen (300ms)

Swipe in fullscreen:
Left/right to navigate between images
Index indicator at top: "1 / 12"

Close:
Tap X button or swipe down
Image shrinks back to grid position (300ms)
```

**Reviews Section:**
```
Expandable section title: "Reviews (47)" with > chevron
Click to expand full reviews list

Individual review cards:
Style: Component library section 3.2
Staggered fade-in as section expands
Show first 3, with "See all" button at bottom

"See all" action:
Navigate to dedicated reviews screen
All reviews with sorting/filtering options
```

**Sticky CTA Button (Bottom):**
```
Position: Fixed, bottom of screen
Style: 
- Background: Sunset Gradient
- Glass effect (slight blur/transparency)
- Full width (minus safe area padding)
- Height: 56px
- Text: "Request This Buddy"

Animation:
On scroll down: Remains visible (sticky)
Offset: 16px from bottom, 12px left/right
Safe area: Accounts for home indicator

Shadow:
Subtle shadow above button (0 -2px 8px rgba(0,0,0,0.1))
Increases on scroll (depth effect)

On tap:
Navigate to booking flow
Button press animation: Scale 0.96 + feedback
```

### 4.4 Live Tour Screen (In-Progress Tour)

**Layout Structure:**
```
Full screen:
1. Map background (full screen, not scrollable)
2. Bottom sheet with tour info (draggable to 3 snap points)
3. SOS button (floating, always accessible)
```

**Map Background:**
```
MapView component
Fit guide and traveler locations with padding
Show current locations with pulse animations
Route line animates in when guide starts navigation
Colors:
- Guide pin: Mumbai Saffron
- Traveler pin: Bougainvillea Pink
- Route line: Mumbai Saffron (2px width)
```

**Location Pins:**
```
Guide pin:
- Teal circle (24px), icon: profile avatar
- Pulse animation: Scale 1 → 1.3 → 1, 2s infinite
- Color pulse: Opacity 100% → 0% → 100%

Traveler pin:
- Coral circle (24px), icon: profile avatar
- Static (no pulse, you're here)

Distance display:
- "500m away" text below traveler pin
- Updates in real-time as distance changes
- Font: DM Sans 12px, bold
```

**Bottom Sheet (Tour Info):**
```
3 snap points:
- Peek (25%): Show time remaining and quick actions
- Half (50%): Full tour info and expense tracker
- Full (90%): Detailed itinerary and instructions

Peek view (draggable handle):
[Handle bar]
"06:30 | 2 hours remaining" — DM Sans 16px bold
[Start button]

Half view:
[Handle bar]
Title: "Street Food & Markets Tour" — Plus Jakarta Sans 18px bold
Time: "2:30 PM - 4:30 PM" — Inter 14px gray
Location: "Bandra Kurla Complex" — Inter 14px

Expense tracker:
Card with:
- Spent: "₹400" (DM Sans 18px)
- Remaining budget: "₹1,600 of ₹2,000"
- Animated bar: Percentage of budget used
- Color: Gradient from green (low) to orange (medium) to red (high)
- Bar updates in real-time

Quick actions (row of 3 buttons):
- 🆘 SOS (red, pulsing)
- ☎️ Call Guide
- 📍 Share Location

Full view:
Scrollable content
- Full itinerary with stops
- Photos and descriptions
- Guide notes and tips
- Expense history
- Option to end tour early
```

**Time Remaining (Timer):**
```
Circular progress indicator
- Outer ring: 60px diameter
- Stroke width: 4px
- Start color: Success Green (when > 1 hour remaining)
- Mid color: Amber (30–60 minutes)
- End color: Coral (< 30 minutes)
- Animated: Depletes as time passes (smooth, real-time)

Center text:
"2:34" — time remaining (h:mm format)
DM Sans 20px bold

Animation:
Color transition as time decreases
Haptic feedback: When crossing time thresholds (1 hour, 30 min, 5 min)
```

**"Time to Head Back" Alert:**
```
Trigger: When remaining time < 30 minutes
Alert position: Slides down from top
Background: Amber gradient (#F39C12 → lighter)
Icon: Clock icon, white
Text: "Time to head back to meet point"
Close button: X (white)

Animation:
Slide down from top: 400ms spring
Stays visible for 8s, then auto-dismiss
Dismiss animation: Slide up (300ms ease-out)
Or tap X to close immediately

Haptic feedback: Heavy vibration pattern when appears
```

**SOS Button (Floating):**
```
Position: Fixed, bottom-right (32px from edges, above bottom sheet peek area)
Style: Pulsing red circle
Size: 56px diameter
Icon: "SOS" text, white, bold
Background: Coral Dark (#BE185D)
Glow: Pulsing red shadow (0 0 20px → 0 0 30px, 1.5s infinite)

On tap:
Modal appears: "Are you safe?"
Options:
1. "I'm safe" (green button) → closes alert
2. "Emergency" (red button) → calls emergency services (guided by authority)
3. "Talk to guide" (blue button) → initiates direct call

Accessibility:
Always floating above map and sheet
Z-index: Very high
Always reachable
```

### 4.5 Booking Success (Confirmation Screen)

**Full-Screen Celebration:**
```
Background: Animated gradient (colors shift slowly)
Duration: 3–4 seconds (before auto-dismiss)
```

**Background Gradient Animation:**
```
Cycle through 3 states:
State 1: Mumbai Saffron to Bougainvillea Pink
State 2: Bougainvillea Pink to Mumbai Purple
State 3: Mumbai Purple to Mumbai Saffron
Duration: 4s each, infinite loop
Easing: Linear (smooth transitions)

Opacity: 100% (fully opaque)
Prevent scroll: User can't scroll during celebration
```

**Confetti Burst:**
```
Lottie animation (pre-designed JSON)
Trigger: Immediate on screen load
Position: Center of screen
Duration: 2.5s
Particles: 20–30 colorful confetti pieces
Colors: Brand palette (teal, coral, gold, purple)
Speed: 400–600px/s outward
Gravity: Slight downward acceleration
Fade-out: Last 500ms (opacity 100% → 0%)
Count: 1 burst only (not repeating)
```

**Checkmark Animation:**
```
SVG path draw animation
Size: 120px diameter (large)
Position: Center of screen
Color: Success Green (#27AE60)
Stroke width: 6px
Stroke style: Rounded caps

Animation:
Stroke draws from 0% → 100% of path
Duration: 400ms ease-out
Followed by glow pulse:
  - Box shadow: 0 0 20px rgba(39, 174, 96, 0.4)
  - Pulses 2x: expand → contract → expand
  - Duration: 200ms per pulse

Haptic feedback: Success pattern
  - Short vibration (100ms)
  - Medium vibration (150ms)
  - Short vibration (100ms)
```

**"You're All Set!" Text:**
```
Font: Plus Jakarta Sans, 36px bold
Color: White
Position: Below checkmark (40px gap)
Initial state: Opacity 0, scale 0.8
Animation:
- Fade in + scale: opacity 0 → 1, scale 0.8 → 1.2
- Duration: 500ms spring
- Delay: 600ms (after checkmark starts)
- Bounce: Slightly overshoots (scale 1.2), then settles to 1.0
```

**Booking Details Card:**
```
Position: Below "You're all set!" text
Background: White with shadow (0 8px 20px rgba(0,0,0,0.15))
Border radius: 16px
Padding: 20px
Width: 90% of screen (centered)
Initial state: Positioned off-screen (translateY: 100%)

Animation:
Slide up: translateY(100%) → 0
Duration: 400ms spring
Delay: 900ms (after checkmark)
Easing: Damping 14, stiffness 160 (bouncier)

Content (inside card):
[Guide avatar — 48px] Name: "Aarav Singh"
"Street Food Tour" — title
"📅 April 15, 2026 | 🕒 2:30 PM" — date/time
"👥 2 travelers" — group size
"💰 ₹4,000 total" — price (bold, coral)
"✓ Booking confirmed" — status (green checkmark)

Close action:
Button at bottom: "View My Trips" or "Back Home"
Tap action: Navigate to trips screen

Auto-dismiss:
After 3.5s, screen fades out and navigates to home
Or user can tap button to dismiss earlier
```

**Timeline:**
```
0ms: Screen loads, background gradient starts
100ms: Confetti burst begins
150ms: Checkmark starts drawing
600ms: "You're all set!" scales in
900ms: Booking card slides up
2000ms: Confetti fades out
3500ms: Auto-dismiss (fade out over 300ms)
4000ms: Navigate to next screen
```

---

## 5. Illustration & Imagery Style

### 5.1 Photography Guidelines

**Tone & Color Grading:**
- Warm, golden-hour aesthetic (Mumbai sunset palette)
- Color temperature: Lifted shadows, rich saturation
- Teal and coral color cast (enhancement)
- Film-like quality (slight grain, not artificial)
- Avoid: Overly saturated, stock photo look, high-contrast black & white

**Subject Matter (Mumbai-Specific):**
- Gateway of India at sunset
- Local street food close-ups (pav bhaji, vada pav, chai cups)
- Authentic local trains and auto-rickshaws
- Marine Drive waterfront
- Local markets (Crawford Market, Bandra Kurla)
- Candid moments: students laughing, travelers exploring, guides teaching

**Composition Requirements:**
- Always show BOTH guide AND traveler together (emphasize shared experience)
- Authentic, candid shots (avoid posed, stiff photography)
- Depth of field: Focus on main subjects, soft background blur
- Framing: Guide helping traveler, learning together, enjoying moment
- Lighting: Golden hour (early morning or late afternoon)

**Image Resolution & Optimization:**
- Always provide 2x resolution for Retina displays
- Crop variations: Square (1:1), portrait (3:4), landscape (16:9)
- Max file size: 500KB per image (use optimization tools)
- Format: WebP for web, JPG for mobile (fallback)

### 5.2 Illustration Style

**Visual Language:**
- Flat design with subtle gradients (not purely flat, not photorealistic)
- Rounded shapes (no sharp angles)
- Consistent stroke weight (2px for outlines)
- Mumbai-specific details (cultural elements, local objects)
- Diverse character representation

**Color Palette for Illustrations:**
- Use only brand colors (#F97316, #EC4899, #F59E0B, #6C5CE7, etc.)
- No custom colors (maintains consistency)
- Gradients: Same library as design system

**Illustration Categories:**

**Empty State Illustrations:**

1. **"No trips yet"**
   - Traveler with suitcase, looking at folded map
   - Suitcase: Coral color, stickers of Mumbai landmarks
   - Map: Unfolded, showing Mumbai
   - Character: Smiling, diverse representation
   - Background: Subtle skyline (Gateway of India outline)
   - Size: 280x240px

2. **"No messages"**
   - Two chat bubbles (one teal, one coral)
   - Mumbai skyline inside bubbles (Gateway, buildings)
   - Message icon between bubbles
   - Characters peeking from sides (friendly)
   - Size: 280x240px

3. **"No reviews yet"**
   - Empty star outline (large, 120px)
   - Traveler waving, encouraging to leave review
   - Thought bubble: Rating stars
   - Size: 280x200px

4. **"Error / Something Went Wrong"**
   - Confused auto-rickshaw driver (character)
   - Auto-rickshaw tilted at angle (comedic)
   - Question mark above head (large, teal)
   - Small details: Tools scattered around
   - Size: 280x240px

5. **"No guides available"**
   - Character with binoculars looking at empty horizon
   - Horizon: Empty ocean/sky
   - Binoculars: Teal color
   - Text: "No guides available for this date"
   - Size: 280x240px

**Onboarding Illustrations:**

1. **Welcome slide 1**: Traveler from airplane, excited expression
2. **Welcome slide 2**: Guide waving, introducing Mumbai
3. **Welcome slide 3**: Handshake between traveler and guide (unity)
4. **Welcome slide 4**: Group having fun together (diverse travelers + guide)

**Feature Illustrations:**

1. **Verified Guide Badge**: Guide with checkmark, confident pose
2. **Fast Responder**: Guide with message bubble, lightning bolt background
3. **Rating System**: Stars animating in, character celebrating
4. **Booking Confirmation**: Handshake with booking details background
5. **Tour Complete**: Guide and traveler high-fiving, celebratory pose

**Icon Set:**

Custom icons needed (complement Lucide icons):
- Auto-rickshaw (3/4 view, teal color)
- Chai cup (stylized, with steam)
- Gateway of India (simplified outline)
- Flight path (dotted line with airplane)
- Buddy handshake (two hands, diverse skin tones)
- Mumbai skyline (stylized, recognizable)
- Rating star (large version)
- Location pin with heart (marker variant)

**Consistency Rules:**
- All illustrations use same line weight (2px)
- Same gradient library for shading
- Consistent proportions (characters)
- Consistent corner radius (12–16px for shapes)
- Same perspective (slight isometric view, not top-down)

### 5.3 Image Optimization

**Blurhash Generation:**
- Every image should have blurhash placeholder
- Use blurhash library to generate (10–30 bytes)
- Decode at app startup for instant display
- Transition: Blur → Sharp (300ms crossfade)

**Image Loading Strategy:**
- Thumbnail (low-res): Load first (50x50px, highly compressed)
- Medium (mobile view): Load on initial view (screen width, optimized)
- High-res (fullscreen): Load on demand (3x screen width, for pinch-zoom)
- Caching: Use HTTP cache headers, local device cache

**Format Recommendations:**
- Mobile: JPG (quality 75–80) or WebP
- Web: WebP with JPG fallback
- Thumbnails: WebP (quality 60)
- Icons: SVG (for scaling)

---

## 6. Accessibility Requirements

### 6.1 Color Contrast

**WCAG AA Compliance (Minimum):**
- Body text: 4.5:1 contrast ratio
- Large text (18px+): 3:1 contrast ratio
- Icons: 3:1 contrast ratio
- UI components: 3:1 contrast ratio

**Testing:**
- Use WCAG contrast checker for all color combinations
- Test with accessibility tools (WAVE, Axe DevTools)
- Verify dark mode variants separately

**High Contrast Mode Support:**
- For users who enable high contrast:
  - Increase stroke width (from 2px to 3px)
  - Use solid colors instead of gradients (gradients may fade)
  - Add outline to text on gradient backgrounds

### 6.2 Touch Targets

**Minimum Size: 44x44px (all interactive elements)**
- Buttons: 44x44px minimum
- Links: 44x44px minimum tap area
- Checkboxes: 44x44px
- Radio buttons: 44x44px
- Tab bar items: 44x44px minimum
- Card tap areas: At least 44px in one dimension

**Spacing:**
- Minimum 8px between adjacent touch targets
- Larger padding (12–16px) for commonly-used buttons
- More spacing on mobile (< 6" screens)

### 6.3 Animation Preferences

**Respect `prefers-reduced-motion`:**
```css
@media (prefers-reduced-motion: reduce) {
  /* Disable animations */
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Implementation:**
- Check system setting on app startup
- Disable spring physics (use instant layout)
- Remove parallax scrolling
- Disable particle animations
- Keep fade transitions (subtle, important for UX)

### 6.4 Screen Reader Support

**Image Alt Text:**
- All images: Descriptive alt text (not "image_001")
- Example: "Aarav Singh, verified guide, 4.9 star rating"
- Decorative images: `alt=""` (empty, ignored by screen readers)
- Icons with text: Icon not read separately

**Semantic HTML:**
- Use semantic elements (button, link, heading)
- Proper heading hierarchy (H1 → H2 → H3)
- Form labels associated with inputs (htmlFor)
- List items in lists (ul/ol), not fake lists

**Screen Reader Labels:**
- Button text: Clear, descriptive ("Request This Buddy", not "Submit")
- Icon buttons: Use `aria-label` ("Back button")
- Form fields: Associated label (`<label htmlFor="...">`)
- Loading state: `aria-busy="true"`, `aria-label="Loading..."`

**Announcing Changes:**
- Use `aria-live="polite"` for status updates (new messages, bookings)
- Modal dialogs: `role="dialog"`, `aria-modal="true"`
- Alerts: `role="alert"`, auto-announced

### 6.5 Font Scaling

**Support up to 200% system font size:**
- Test with 150%, 175%, 200% scaling
- Text should reflow, not truncate
- Layout shouldn't break with larger text
- Line height should increase proportionally

**Implementation:**
- Use `rem` units (not px) for font sizes
- Base font size: 16px (1rem)
- Line height: 1.5–1.8 (generous spacing)
- Padding/margin: Scale with font size (use em units)

### 6.6 Dark Mode

**Color Palette (Dark Theme):**

| Light Theme | Dark Theme | Usage |
|------------|-----------|-------|
| Warm Cream (#FFFAF5) | Dark Base (#0F0F1A) | Primary background |
| Midnight Navy (#0B1229) | Light Gray (#F5F5F5) | Primary text |
| Mumbai Saffron (#F97316) | Mumbai Saffron (#F97316) | Primary actions (same) |
| Bougainvillea Pink (#EC4899) | Bougainvillea Pink (#EC4899) | Energy/alerts (same) |
| Warm Cream cards | Card Dark (#0B1229) | Card backgrounds |
| Subtle shadows | Stronger shadows | Depth (higher opacity) |

**Dark Theme Rules:**
- Never use pure white on dark background (#FFF is too bright)
- Use off-white (#F5F5F5) for text
- Use dark grays (#A0A0B0) for secondary text
- Keep same teal and coral (good contrast on dark)
- Gradients: Adjust opacity to prevent over-brightening

**Implementation:**
- Use CSS custom properties (variables) for all colors
- Toggle theme with `useColorScheme()` hook (React Native)
- Store user preference in AsyncStorage
- Respect system dark mode preference by default

---

## 7. Implementation Notes for React Native / Expo

### 7.1 Animation Libraries

**react-native-reanimated v3 (REQUIRED for all animations):**
```bash
npm install react-native-reanimated@3
```

**Key APIs:**
- `Animated.createValue()` — Create shared values
- `withSpring()` — Spring physics animations
- `withTiming()` — Linear/eased animations
- `interpolate()` — Map one value range to another
- `runOnUI()` — Execute JS on UI thread

**Spring Animation Boilerplate:**
```javascript
import Animated, { withSpring } from 'react-native-reanimated';

const scale = useSharedValue(1);

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }],
}));

const handlePress = () => {
  scale.value = withSpring(0.96, {
    damping: 15,
    stiffness: 150,
    mass: 1,
  });
};

return <Animated.View style={animatedStyle} />;
```

**react-native-gesture-handler v2:**
```bash
npm install react-native-gesture-handler@2
```

**Key Gestures:**
- `GestureDetector` — Wrapper component
- `TapGesture` — Single/double tap, long press
- `PanGesture` — Drag, swipe
- `PinchGesture` — Zoom

**Example Pan Gesture:**
```javascript
const translateY = useSharedValue(0);

const gesture = Gesture.Pan()
  .onUpdate((e) => {
    translateY.value = e.translationY;
  })
  .onEnd((e) => {
    translateY.value = withSpring(0); // Snap back
  });

return (
  <GestureDetector gesture={gesture}>
    <Animated.View style={animatedStyle} />
  </GestureDetector>
);
```

### 7.2 Image Library

**expo-image (NOT React Native Image):**
```bash
npx expo install expo-image expo-blur
```

**Features:**
- Blurhash support (instant placeholder)
- Automatic WebP fallback
- Caching (out of box)
- Smooth transitions
- Memory management

**Usage:**
```javascript
import { Image } from 'expo-image';

export function GuideCard({ imageUrl, blurhash }) {
  return (
    <Image
      source={{ uri: imageUrl }}
      placeholder={blurhash} // Base64 blurhash
      contentFit="cover"
      transition={300}
      style={{ width: '100%', height: 200 }}
    />
  );
}
```

### 7.3 List Performance

**@shopify/flash-list (Replace FlatList):**
```bash
npm install @shopify/flash-list
```

**10x performance improvement over FlatList:**
- Recycles items more aggressively
- Reduces memory usage
- Smoother scrolling (60fps consistent)
- Same API as FlatList (drop-in replacement)

**Usage:**
```javascript
import { FlashList } from '@shopify/flash-list';

export function GuideList({ guides }) {
  return (
    <FlashList
      data={guides}
      renderItem={({ item }) => <GuideCard guide={item} />}
      keyExtractor={(item) => item.id}
      estimatedItemSize={300}
      onScroll={handleScroll}
    />
  );
}
```

### 7.4 Lottie Animations

**lottie-react-native:**
```bash
npm install lottie-react-native
```

**Celebration Animations:**
- Confetti burst (use pre-designed Lottie JSON)
- Fireworks
- Money rain
- Gift box open
- Checkmark draw

**Best Practices:**
- Keep animation files under 30KB (gzip)
- Use Lottie editor to export clean JSON
- Pre-load animations at app startup
- Use `useSharedValue()` to control playback

**Example:**
```javascript
import LottieView from 'lottie-react-native';

export function ConfettiBurst() {
  return (
    <LottieView
      source={require('./confetti.json')}
      autoPlay
      loop={false}
      duration={2500}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
```

### 7.5 Navigation Structure (React Navigation)

**Stack Configuration:**
```javascript
const Stack = createNativeStackNavigator();

function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#FFFAF5' },
        animationEnabled: true,
        animationTypeForReplace: isSignedIn ? 'pop' : 'fade',
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="GuideProfile" component={GuideProfileScreen} />
      <Stack.Screen 
        name="Booking" 
        component={BookingScreen}
        options={{
          animationEnabled: true,
          presentation: 'card',
        }}
      />
    </Stack.Navigator>
  );
}
```

**Custom Transition Animations:**
```javascript
const forSlide = ({ current, next, inverted, layouts: { screen } }) => {
  const progress = Animated.add(
    current.progress,
    next ? next.progress : 0
  ).interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 1, 2],
  });

  const translateFocused = Animated.multiply(
    progress,
    Animated.add(
      screen.width,
      isRTL ? 1 : -1
    )
  );

  return {
    cardStyle: {
      transform: [{ translateX: translateFocused }],
    },
  };
};
```

### 7.6 State Management (Zustand Recommended)

```bash
npm install zustand
```

**Store Example:**
```javascript
import { create } from 'zustand';

export const useTravelStore = create((set) => ({
  selectedGuide: null,
  bookingData: null,
  setSelectedGuide: (guide) => set({ selectedGuide: guide }),
  setBookingData: (data) => set({ bookingData: data }),
  clearBooking: () => set({ bookingData: null, selectedGuide: null }),
}));
```

### 7.7 Form Handling (React Hook Form)

```bash
npm install react-hook-form
```

**Boilerplate:**
```javascript
import { useForm, Controller } from 'react-hook-form';

export function BookingForm() {
  const { control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { date: '', time: '', travelers: 1 },
  });

  return (
    <Controller
      control={control}
      name="date"
      rules={{ required: 'Date is required' }}
      render={({ field: { value, onChange } }) => (
        <DatePicker value={value} onChange={onChange} />
      )}
    />
  );
}
```

### 7.8 API Integration (Axios + React Query)

```bash
npm install axios @tanstack/react-query
```

**Query Setup:**
```javascript
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

const apiClient = axios.create({ baseURL: 'https://api.mumbaibuddies.com' });

export function useGuides(filters) {
  return useQuery({
    queryKey: ['guides', filters],
    queryFn: () => apiClient.get('/guides', { params: filters }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useBookGuide() {
  return useMutation({
    mutationFn: (bookingData) => apiClient.post('/bookings', bookingData),
    onSuccess: (data) => {
      // Show celebration animation
      showSuccessAnimation();
    },
  });
}
```

### 7.9 Notifications (Expo Notifications)

```bash
npx expo install expo-notifications
```

**Push Notification Integration:**
```javascript
import * as Notifications from 'expo-notifications';

export async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  // Send token to backend
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

### 7.10 Styling Best Practices

**Use StyleSheet for performance:**
```javascript
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFAF5',
    paddingHorizontal: 16,
  },
  button: {
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
```

**Global theme context:**
```javascript
import { createContext, useContext } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const colors = {
    primary: '#F97316',
    secondary: '#EC4899',
    background: '#FFFAF5',
    text: '#0B1229',
  };

  return (
    <ThemeContext.Provider value={colors}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

---

## 8. Development Checklist

### Phase 1: Foundation (Weeks 1–2)
- [ ] Set up React Native/Expo project
- [ ] Install and configure reanimated, gesture-handler, expo-image
- [ ] Create design token files (colors, typography, spacing)
- [ ] Build component library (buttons, cards, inputs)
- [ ] Create custom animation hooks (useSpring, useFade, etc.)

### Phase 2: Screens & Navigation (Weeks 3–4)
- [ ] Implement welcome/onboarding flow
- [ ] Build guide browse screen with animations
- [ ] Create guide profile screen with parallax
- [ ] Set up bottom tab navigation
- [ ] Test all page transitions

### Phase 3: Interactions & Polish (Weeks 5–6)
- [ ] Implement all micro-interactions (button presses, card taps)
- [ ] Add scroll animations (parallax, fade-in, sticky header)
- [ ] Create loading states with skeleton screens
- [ ] Build celebration animations (booking, reviews, payouts)
- [ ] Add haptic feedback throughout

### Phase 4: Dark Mode & Accessibility (Week 7)
- [ ] Implement dark mode theme
- [ ] Test color contrast (WCAG AA compliance)
- [ ] Add screen reader support
- [ ] Test with accessibility tools (WAVE, Axe)
- [ ] Enable `prefers-reduced-motion` support

### Phase 5: Testing & Optimization (Week 8)
- [ ] Performance profiling (60fps animations)
- [ ] Memory leak detection
- [ ] Test on multiple devices
- [ ] Network throttling tests
- [ ] Battery/thermal testing

---

## 9. File Organization

```
project-root/
├── design/
│   ├── brand/
│   │   ├── design-system.md (this file)
│   │   ├── color-tokens.json
│   │   └── typography-scale.json
│   ├── illustrations/
│   │   ├── empty-states/
│   │   │   ├── no-trips.svg
│   │   │   ├── no-messages.svg
│   │   │   └── no-guides.svg
│   │   ├── onboarding/
│   │   │   ├── slide-1.svg
│   │   │   ├── slide-2.svg
│   │   │   ├── slide-3.svg
│   │   │   └── slide-4.svg
│   │   └── features/
│   │       ├── verified-badge.svg
│   │       └── fast-responder.svg
│   ├── animations/
│   │   ├── confetti.json
│   │   ├── fireworks.json
│   │   ├── money-rain.json
│   │   └── checkmark-draw.json
│   └── screenshots/
│       └── reference-screens/ (Figma exports)
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Input.tsx
│   │   ├── animated/
│   │   │   ├── AnimatedButton.tsx
│   │   │   ├── AnimatedCard.tsx
│   │   │   └── SkeletonLoader.tsx
│   │   ├── screens/
│   │   │   ├── Welcome.tsx
│   │   │   ├── GuideBrowse.tsx
│   │   │   ├── GuideProfile.tsx
│   │   │   └── BookingSuccess.tsx
│   │   └── layout/
│   │       ├── BottomTabBar.tsx
│   │       └── AppHeader.tsx
│   ├── navigation/
│   │   ├── RootNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── AppNavigator.tsx
│   ├── hooks/
│   │   ├── useAnimatedStyle.ts
│   │   ├── useSpring.ts
│   │   ├── useFadeIn.ts
│   │   └── useParallax.ts
│   ├── styles/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   └── theme.ts
│   ├── utils/
│   │   ├── animations.ts
│   │   └── colors.ts
│   └── App.tsx
└── package.json
```

---

## 10. Testing Guidelines

### Animation Testing
- Use React Native Testing Library with `waitFor()`
- Test animation timings with `jest.useFakeTimers()`
- Verify spring physics parameters produce expected bounce
- Snapshot test animated components

### Accessibility Testing
- Use `react-native-testing-library` with accessibility queries
- Test with screen reader (iOS VoiceOver, Android TalkBack)
- Verify contrast ratios with tools
- Test with 200% font scaling

### Performance Testing
- Profile with React DevTools Profiler
- Monitor frame rate (should be consistent 60fps)
- Check memory usage (no leaks)
- Test with network throttling (3G, 4G)

---

## 11. Design System Maintenance

### Version Control
- Update this document with every design change
- Use semantic versioning (1.0.0, 1.1.0, 2.0.0)
- Document breaking changes clearly
- Maintain backwards compatibility when possible

### Component Deprecation
- Mark deprecated components (with timeline)
- Provide migration guide to new components
- Keep deprecated components functional for 2 releases

### Contribution Guidelines
- All new components must follow this design system
- Colors only from palette (no custom colors)
- Typography only from scale (no custom sizes)
- Animations must use standard easings and durations
- Submit design review before implementation

---

## 12. Resources & References

**Design Tools:**
- Figma (for design mockups and handoff)
- Lottie (for animation creation)
- Blurhash (for image placeholders)

**Documentation:**
- React Native: https://reactnative.dev
- Expo: https://docs.expo.dev
- Reanimated: https://docs.swmansion.com/react-native-reanimated
- Gesture Handler: https://docs.swmansion.com/react-native-gesture-handler
- React Navigation: https://reactnavigation.org

**Accessibility:**
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines
- Material Design Accessibility: https://material.io/design/usability/accessibility.html

**Color Tools:**
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Coolors: https://coolors.co
- Accessible Colors: https://accessible-colors.com

---

**End of Design System Document**

*This design system represents the visual and interaction foundation of Mumbai Buddies. It prioritizes beauty, animation, and intuitive user experience while maintaining accessibility and performance standards.*

*For questions or clarifications, refer to the implementation notes or consult the design team.*
