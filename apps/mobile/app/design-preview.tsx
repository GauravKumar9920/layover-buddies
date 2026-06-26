/**
 * Warm Editorial — design preview gallery (dev/review only).
 *
 * Renders the new theme + component kit + representative screens with sample
 * data so the redesign can be screenshotted without a backend or sign-in.
 * Reachable at /design-preview (auth redirect is bypassed in app/_layout.tsx).
 */
import { useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/config/theme';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { StarRating } from '@/components/ui/StarRating';
import { GuideCard } from '@/components/guides/GuideCard';
import { BoardingPassReveal } from '@/components/bookings/BoardingPassReveal';
import type { GuideProfile } from '@/types';

const C = theme.colors;
const F = theme.fonts;

// ── Sample data ─────────────────────────────────────────────────────────────
const GUIDES: GuideProfile[] = [
  {
    id: 'g-aanya', user_id: 'u1', name: 'Aanya Deshmukh',
    bio: 'Architecture student. I show you the Bombay behind the postcards — Irani cafés, Art Deco, the fish market at dawn.',
    avatar_url: null, avg_rating: 4.9, total_reviews: 38, is_active: true,
    languages: ['English', 'Hindi', 'Marathi'], hometown: 'Dadar, Mumbai',
    categories: ['Food', 'History'], created_at: '2026-01-01',
  },
  {
    id: 'g-rohan', user_id: 'u2', name: 'Rohan Iyer',
    bio: 'Photographer chasing the best light in the city.',
    avatar_url: null, avg_rating: 0, total_reviews: 0, is_active: true,
    languages: ['English', 'Tamil'], hometown: 'Bandra, Mumbai',
    categories: ['Photography', 'Hidden Gems'], created_at: '2026-03-01',
  },
];

const ITINERARIES = [
  { title: 'First-time Mumbai classic', mood: 'The greatest hits', hours: 6, price: 2400, img: 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=800&q=80' },
  { title: 'Where Mumbaikars actually go', mood: 'Local & unfiltered', hours: 5, price: 2100, img: 'https://images.unsplash.com/photo-1586500036706-41963de24d8b?auto=format&fit=crop&w=800&q=80' },
];

// ── Small editorial helpers ─────────────────────────────────────────────────
function Eyebrow({ children, color = C.textMuted }: { children: string; color?: string }) {
  return <Text style={{ ...theme.typography.eyebrow, color }}>{children}</Text>;
}
function Stamp({ label, bg = C.surfaceMuted, fg = C.textSecondary, border = 'rgba(14,25,41,0.12)' }: { label: string; bg?: string; fg?: string; border?: string }) {
  return (
    <View style={{ backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: theme.borderRadius.sm, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: F.monoMed, fontSize: 9.5, letterSpacing: 0.6, textTransform: 'uppercase', color: fg }}>{label}</Text>
    </View>
  );
}
function Rule() {
  return <View style={{ height: 1, backgroundColor: 'rgba(14,25,41,0.10)' }} />;
}

// A phone-sized frame with a caption, so several screens sit side by side.
function Phone({ label, children, bg = C.background }: { label: string; children: React.ReactNode; bg?: string }) {
  return (
    <View style={{ width: 384, marginRight: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary }} />
        <Text style={{ fontFamily: F.monoMed, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: C.text }}>{label}</Text>
      </View>
      <View style={{ height: 812, borderRadius: 30, borderWidth: 1.5, borderColor: C.inkLine, backgroundColor: bg, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

// ── Screen: Explore (traveler browse) ───────────────────────────────────────
function ExploreScreen() {
  const FILTERS = ['All', 'Food', 'History', 'Culture', 'Photography'];
  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: C.surface, paddingTop: 16, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(14,25,41,0.12)' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <View>
            <Eyebrow>Good day, Marco</Eyebrow>
            <Text style={{ fontFamily: F.display, fontSize: 26, color: C.text, letterSpacing: -0.4, marginTop: 3 }}>Find your Buddy</Text>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.primaryLight, borderWidth: 1, borderColor: 'rgba(200,84,42,0.3)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 16, color: C.primaryDark }}>↪</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.background, borderWidth: 1.5, borderColor: 'rgba(14,25,41,0.16)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
          <Text style={{ fontSize: 15, color: C.textMuted }}>⌕</Text>
          <Text style={{ fontFamily: F.body, fontSize: 14, color: C.textMuted }}>Search guides, experiences…</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {FILTERS.map((f, i) => (
            <View key={f} style={{
              paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
              backgroundColor: i === 0 ? C.primary : C.surface,
              borderWidth: 1.5, borderColor: i === 0 ? C.primaryDark : 'rgba(14,25,41,0.14)',
            }}>
              <Text style={{ fontFamily: F.bodySemi, fontSize: 12, color: i === 0 ? '#FCF7EA' : C.textSecondary }}>{f}</Text>
            </View>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 12 }}><Eyebrow>2 guides available</Eyebrow></View>
        {GUIDES.map((g, i) => (
          <GuideCard key={g.id} guide={g} index={i} itineraryPrice={i === 0 ? 2400 : undefined} layoverHours={12} shortestTourHours={3} travelerInterests={['Food', 'History']} />
        ))}
      </ScrollView>
    </View>
  );
}

// ── Screen: Guide profile (editorial zine) ──────────────────────────────────
function GuideProfileScreen() {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }}>
        {/* Editorial hero */}
        <View style={{ height: 420, position: 'relative', backgroundColor: C.text }}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80' }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          <LinearGradient colors={['transparent', 'rgba(14,25,41,0.3)', 'rgba(14,25,41,0.9)']} start={{ x: 0.5, y: 0.15 }} end={{ x: 0.5, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 320 }} />
          <View style={{ position: 'absolute', top: 16, left: 16 }}>
            <Text style={{ color: '#FCF7EA', fontSize: 22, lineHeight: 24 }}>‹</Text>
          </View>
          <View style={{ position: 'absolute', top: 18, right: 18, alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: F.monoMed, color: 'rgba(252,247,234,0.85)', fontSize: 10, letterSpacing: 2.5 }}>DETOUR · MUMBAI</Text>
            <Text style={{ fontFamily: F.mono, color: 'rgba(252,247,234,0.6)', fontSize: 10, letterSpacing: 2, marginTop: 3 }}>ISSUE N° 47</Text>
          </View>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 26 }}>
            <View style={{ width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: 'rgba(252,247,234,0.85)', backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Text style={{ fontFamily: F.display, color: '#FCF7EA', fontSize: 26 }}>AD</Text>
            </View>
            <Text style={{ fontFamily: F.monoMed, color: 'rgba(252,247,234,0.78)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>A walking feature with</Text>
            <Text style={{ fontFamily: F.displayX, color: '#FCF7EA', fontSize: 40, letterSpacing: -1.2, lineHeight: 44 }}>Aanya Deshmukh</Text>
            <Text style={{ fontFamily: F.serif, color: 'rgba(252,247,234,0.88)', fontSize: 17, marginTop: 8 }}>Sir J.J. College · Dadar</Text>
          </View>
        </View>

        {/* Body */}
        <View style={{ backgroundColor: C.background, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -26, paddingTop: 30 }}>
          <View style={{ paddingHorizontal: 22 }}>
            <Text style={{ ...theme.typography.eyebrow, color: C.primary, marginBottom: 12 }}>The interview</Text>
            <Text style={{ fontFamily: F.serif, fontSize: 30, lineHeight: 36, color: C.text, letterSpacing: -0.2 }}>
              “Six hours is enough to fall a little in love with this city.”
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 14 }}>— Aanya, in her own words</Text>
          </View>

          {/* Stats */}
          <View style={{ marginTop: 26, marginHorizontal: 22, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(14,25,41,0.12)', backgroundColor: C.surface, flexDirection: 'row', justifyContent: 'space-between' }}>
            {[['Walks led', '38'], ['Rating', '4.9'], ['Languages', '3'], ['Tours', '4']].map(([l, v], i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: F.monoMed, fontSize: 21, color: C.text, letterSpacing: -0.5 }}>{v}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 9.5, color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 5 }}>{l}</Text>
              </View>
            ))}
          </View>

          {/* Prompt */}
          <View style={{ marginTop: 30, paddingHorizontal: 22 }}>
            <Text style={{ ...theme.typography.eyebrow, color: C.primary, letterSpacing: 1.5 }}>Three things about me</Text>
            <View style={{ marginTop: 14, padding: 16, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: 'rgba(14,25,41,0.1)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: F.monoMed, fontSize: 11, color: C.primary }}>1</Text>
                </View>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>What I love about my city</Text>
              </View>
              <Text style={{ fontFamily: F.serif, fontSize: 20, lineHeight: 27, color: C.text }}>
                Most people leave remembering one 15-minute conversation at a juice stall. I make that happen on purpose.
              </Text>
            </View>
          </View>

          {/* Reviews */}
          <View style={{ marginTop: 30, paddingHorizontal: 22 }}>
            <Text style={{ ...theme.typography.eyebrow, color: C.primary, letterSpacing: 1.5 }}>What travelers said</Text>
            <View style={{ marginTop: 14, borderLeftWidth: 2, borderLeftColor: C.primary, paddingLeft: 14 }}>
              <StarRating rating={5} size={12} />
              <Text style={{ fontFamily: F.serif, fontSize: 19, lineHeight: 25, color: C.text, marginTop: 8 }}>“Best six hours of my whole trip. Aanya is the reason I’m coming back.”</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 10.5, color: C.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 8 }}>— Marco · May 2026</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Clean sticky footer: From · Message · Walk with Aanya */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(244,237,221,0.97)', borderTopWidth: 1, borderTopColor: 'rgba(14,25,41,0.12)', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View>
          <Text style={{ ...theme.typography.eyebrow, color: C.textMuted }}>From</Text>
          <Text style={{ fontFamily: F.monoMed, fontSize: 20, color: C.text, letterSpacing: -0.5, marginTop: 1 }}>₹2,100</Text>
        </View>
        <Button title="Message" variant="secondary" size="lg" onPress={() => {}} />
        <View style={{ flex: 1 }}>
          <Button title="Walk with Aanya" size="lg" onPress={() => {}} />
        </View>
      </View>
    </View>
  );
}

// ── Screen: Booking ─────────────────────────────────────────────────────────
function BookingScreen() {
  return (
    <View style={{ flex: 1 }}>
      <LinearHeader />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Eyebrow>Step 2 of 3 · Choose a route</Eyebrow>
        <View style={{ gap: 12, marginTop: 12 }}>
          {ITINERARIES.map((it, i) => (
            <View key={it.title} style={{
              borderRadius: 14, overflow: 'hidden',
              borderWidth: i === 0 ? 2 : 1, borderColor: i === 0 ? C.primary : 'rgba(14,25,41,0.12)',
              backgroundColor: C.surface,
            }}>
              <Image source={{ uri: it.img }} style={{ width: '100%', height: 120 }} contentFit="cover" />
              <View style={{ padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.displaySemi, fontSize: 15, color: C.text }}>{it.title}</Text>
                  {i === 0 && <Stamp label="Selected" bg={C.primaryLight} fg={C.primaryDark} border="rgba(200,84,42,0.3)" />}
                </View>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.textMuted, marginTop: 4, textTransform: 'uppercase' }}>{it.hours} hours</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 22, gap: 14 }}>
          <Input label="Arrival" placeholder="14 Jun, 08:30" value="" onChangeText={() => {}} />
          <Input label="Departure" placeholder="14 Jun, 19:00" value="" onChangeText={() => {}} />
          <Input label="Flight number" placeholder="EK 500" value="" onChangeText={() => {}} />
        </View>

        {/* Price breakdown — ticket stub */}
        <View style={{ marginTop: 22, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1.5, borderColor: C.inkLine, padding: 16 }}>
          <Eyebrow>Price breakdown</Eyebrow>
          <View style={{ gap: 10, marginTop: 12 }}>
            {[['Buddy fee', '₹2,400'], ['Estimated expenses (30%)', '₹720'], ['Platform fee', '₹600']].map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: F.body, fontSize: 14, color: C.textSecondary }}>{k}</Text>
                <Text style={{ fontFamily: F.monoMed, fontSize: 14, color: C.text }}>{v}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginVertical: 14 }}><Rule /></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.text }}>Total</Text>
            <Text style={{ ...theme.typography.price, color: C.primary }}>₹3,720</Text>
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <Button title="Confirm request" onPress={() => {}} size="lg" />
        </View>
      </ScrollView>
    </View>
  );
}

function LinearHeader() {
  return (
    <View style={{ backgroundColor: C.text, paddingTop: 16, paddingBottom: 18, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Image source={{ uri: 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=200&q=80' }} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(252,247,234,0.3)' }} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.display, fontSize: 18, color: '#FCF7EA' }}>Book Aanya</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <Text style={{ fontFamily: F.monoMed, fontSize: 11, color: C.gold }}>★ 4.9</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: 'rgba(252,247,234,0.6)' }}>· Dadar, Mumbai</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Screen: Trip detail ─────────────────────────────────────────────────────
function TripDetailScreen() {
  return (
    <View style={{ flex: 1 }}>
      {/* Ink header */}
      <View style={{ backgroundColor: C.text, paddingTop: 16, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#FCF7EA', fontSize: 22, lineHeight: 24 }}>‹</Text>
          <Stamp label="Trip ready" bg="rgba(61,139,90,0.22)" fg="#9FE0B6" border="rgba(61,139,90,0.5)" />
        </View>
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(252,247,234,0.55)', marginTop: 14 }}>Your trip · 14 Jun</Text>
        <Text style={{ fontFamily: F.display, fontSize: 26, color: '#FCF7EA', letterSpacing: -0.4, marginTop: 4 }}>First-time Mumbai classic</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=120&q=80' }} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(252,247,234,0.3)' }} contentFit="cover" />
          <Text style={{ fontFamily: F.bodySemi, fontSize: 14, color: '#FCF7EA' }}>with Aanya</Text>
          <View style={{ flex: 1 }} />
          <View style={{ borderWidth: 1.5, borderColor: 'rgba(252,247,234,0.4)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
            <Text style={{ fontFamily: F.bodySemi, fontSize: 12, color: '#FCF7EA' }}>Message</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Boarding-pass ticket */}
        <View style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1.5, borderColor: C.inkLine, overflow: 'hidden' }}>
          <View style={{ padding: 16 }}>
            <Eyebrow>Boarding pass</Eyebrow>
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              {[['Arrival', '08:30'], ['', '→'], ['Departure', '19:00']].map(([k, v], i) => (
                <View key={i} style={{ flex: k ? 1 : 0.5, alignItems: k === 'Departure' ? 'flex-end' : k ? 'flex-start' : 'center', justifyContent: 'center' }}>
                  {k ? <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: C.textMuted }}>{k}</Text> : null}
                  <Text style={{ fontFamily: F.monoMed, fontSize: k ? 22 : 16, color: k ? C.text : C.textMuted, marginTop: k ? 2 : 0 }}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
          {/* perforation */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.background, marginLeft: -8, borderWidth: 1.5, borderColor: C.inkLine }} />
            <View style={{ flex: 1, height: 1, borderBottomWidth: 1.5, borderColor: C.inkLine, borderStyle: 'dashed' }} />
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.background, marginRight: -8, borderWidth: 1.5, borderColor: C.inkLine }} />
          </View>
          <View style={{ padding: 16, gap: 10 }}>
            {[['Flight', 'EK 500'], ['Meeting point', 'T2 Arrivals, Gate 5'], ['Travellers', '2 adults']].map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: C.textMuted }}>{k}</Text>
                <Text style={{ fontFamily: F.bodySemi, fontSize: 14, color: C.text }}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Live CTA */}
        <View style={{ marginTop: 18 }}>
          <View style={{ borderRadius: 12, paddingVertical: 16, alignItems: 'center', backgroundColor: C.accent, borderWidth: 1.5, borderColor: C.accentDark, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#9FE0B6' }} />
            <Text style={{ fontFamily: F.bodyBold, fontSize: 16, color: '#FCF7EA' }}>Track Aanya live</Text>
          </View>
        </View>

        {/* Paid summary */}
        <View style={{ marginTop: 18, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(14,25,41,0.1)', padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Eyebrow>Paid · deposit held</Eyebrow>
              <Text style={{ ...theme.typography.price, color: C.text, marginTop: 4 }}>₹1,860</Text>
            </View>
            <Stamp label="View receipt" bg={C.surfaceMuted} fg={C.textSecondary} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Screen: Itinerary detail (Hinge-style) ──────────────────────────────────
function ItineraryScreen() {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }}>
        <View style={{ height: 360, position: 'relative', backgroundColor: C.text }}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1576502200916-3808e07386a5?auto=format&fit=crop&w=1200&q=80' }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          <LinearGradient colors={['transparent', 'rgba(14,25,41,0.2)', 'rgba(14,25,41,0.85)']} start={{ x: 0.5, y: 0.2 }} end={{ x: 0.5, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 240 }} />
          <View style={{ position: 'absolute', top: 16, left: 16 }}><Text style={{ color: '#FCF7EA', fontSize: 22 }}>‹</Text></View>
          <View style={{ position: 'absolute', top: 16, right: 16, flexDirection: 'row', gap: 8 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(14,25,41,0.35)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FCF7EA', fontSize: 16 }}>↗</Text></View>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(14,25,41,0.35)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FCF7EA', fontSize: 18 }}>♡</Text></View>
          </View>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 26 }}>
            <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(252,247,234,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 10 }}>
              <Text style={{ fontFamily: F.monoMed, color: '#FCF7EA', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Food</Text>
            </View>
            <Text style={{ fontFamily: F.displayX, fontSize: 34, color: '#FCF7EA', letterSpacing: -0.8, lineHeight: 40 }}>Bazaar to Bandstand</Text>
            <Text style={{ fontFamily: F.mono, color: 'rgba(252,247,234,0.9)', fontSize: 11, marginTop: 10, letterSpacing: 0.4, textTransform: 'uppercase' }}>Mumbai  ·  5h  ·  6 stops</Text>
          </View>
        </View>

        <View style={{ backgroundColor: C.background, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -26, paddingTop: 22 }}>
          <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ flex: 1, paddingRight: 14, fontFamily: F.serif, fontSize: 21, color: C.text, lineHeight: 27 }}>A five-hour food walk through the city, told by a local who's lived it.</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: F.monoMed, fontSize: 24, color: C.primary, letterSpacing: -0.5 }}>₹2,100</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 9.5, color: C.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 2 }}>buddy fee</Text>
            </View>
          </View>

          {/* Guide strip */}
          <View style={{ marginHorizontal: 20, marginTop: 20, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: 'rgba(14,25,41,0.1)' }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: F.display, fontSize: 19, color: '#FCF7EA' }}>AD</Text></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ ...theme.typography.eyebrow, color: C.textMuted }}>Your buddy</Text>
              <Text style={{ fontFamily: F.displaySemi, fontSize: 17, color: C.text, marginTop: 3 }}>Aanya Deshmukh</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.textSecondary, marginTop: 3 }}>4.9 · 38 reviews</Text>
            </View>
            <Text style={{ color: C.primary, fontSize: 20 }}>›</Text>
          </View>

          {/* Prompt card */}
          <View style={{ marginHorizontal: 20, marginTop: 20, padding: 20, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: 'rgba(14,25,41,0.1)' }}>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>The moment I always remember is…</Text>
            <Text style={{ fontFamily: F.serif, fontSize: 24, lineHeight: 31, color: C.text, marginTop: 10 }}>The chai stall halfway through — uncle knows my order before I sit down. Best ₹20 of your day.</Text>
          </View>
          <View style={{ marginHorizontal: 20, marginTop: 20, height: 200, borderRadius: 16, overflow: 'hidden' }}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1000&q=80' }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          </View>
        </View>
      </ScrollView>

      {/* Footer: heart · Message · Request */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(244,237,221,0.97)', borderTopWidth: 1, borderTopColor: 'rgba(14,25,41,0.12)', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: 'rgba(14,25,41,0.18)', backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24, color: C.textSecondary }}>♡</Text></View>
        <Button title="Message" variant="secondary" size="lg" onPress={() => {}} />
        <View style={{ flex: 1 }}><Button title="Request · ₹2,100" size="lg" onPress={() => {}} /></View>
      </View>
    </View>
  );
}

// ── Screen: Onboarding ──────────────────────────────────────────────────────
function OnboardingScreen2() {
  const INTERESTS = [['Food & Street Eats', '🍜', true], ['History', '📚', false], ['Photography', '📸', true], ['Culture & Arts', '🎭', false], ['Hidden Gems', '💎', true], ['Architecture', '🏛️', false]];
  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: C.text, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 24 }}>
        <Text style={{ fontFamily: F.mono, color: 'rgba(252,247,234,0.7)', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Step 3 of 4</Text>
        <Text style={{ fontFamily: F.display, color: '#FCF7EA', fontSize: 26, letterSpacing: -0.4 }}>What interests you?</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
          {[1, 2, 3, 4].map((s) => <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: s <= 3 ? C.primary : 'rgba(252,247,234,0.2)' }} />)}
        </View>
      </View>
      <View style={{ padding: 20 }}>
        <Text style={{ fontFamily: F.body, fontSize: 14, color: C.textSecondary, marginBottom: 16, lineHeight: 20 }}>Pick at least one — we'll surface buddies whose vibe matches.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {INTERESTS.map(([label, emoji, sel], i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: sel ? C.primaryLight : C.surface, borderColor: sel ? C.primary : 'rgba(14,25,41,0.14)', borderWidth: sel ? 2 : 1.5, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14 }}>
              <Text style={{ fontSize: 16 }}>{emoji as string}</Text>
              <Text style={{ fontFamily: sel ? F.bodyBold : F.bodyMed, fontSize: 14, color: sel ? C.primaryDark : C.text }}>{label as string}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: 'rgba(14,25,41,0.12)', padding: 16, paddingBottom: 20, flexDirection: 'row', gap: 10 }}>
        <View style={{ paddingHorizontal: 18, justifyContent: 'center' }}><Text style={{ fontFamily: F.bodySemi, color: C.textSecondary, fontSize: 15 }}>Back</Text></View>
        <View style={{ flex: 1 }}><Button title="Continue" size="lg" onPress={() => {}} /></View>
      </View>
    </View>
  );
}

// ── Screen: Type & color specimen ───────────────────────────────────────────
function SpecimenScreen() {
  const SWATCHES: [string, string][] = [
    ['Paper', C.background], ['Surface', C.surface], ['Ink', C.text],
    ['Terracotta', C.primary], ['Marigold', C.gold], ['Sea', C.accent],
    ['Olive', C.olive], ['Pink', C.pink], ['Green', C.success],
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 22 }} showsVerticalScrollIndicator={false}>
      <Eyebrow>Detour · Warm Editorial</Eyebrow>
      <Text style={{ fontFamily: F.displayX, fontSize: 40, lineHeight: 46, color: C.text, letterSpacing: -1, marginTop: 6 }}>City of{'\n'}layovers</Text>
      <Text style={{ fontFamily: F.serif, fontSize: 26, lineHeight: 30, color: C.primary, marginTop: 8 }}>Six hours is enough.</Text>
      <Text style={{ fontFamily: F.body, fontSize: 15, lineHeight: 24, color: C.textSecondary, marginTop: 14 }}>
        Body copy is Plus Jakarta Sans. Numbers and labels are DM Mono. Headlines are Bricolage Grotesque; warm human moments use Instrument Serif.
      </Text>

      <View style={{ marginTop: 24 }}><Eyebrow>Palette</Eyebrow></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
        {SWATCHES.map(([name, color]) => (
          <View key={name} style={{ width: 100 }}>
            <View style={{ height: 56, borderRadius: 10, backgroundColor: color, borderWidth: 1, borderColor: 'rgba(14,25,41,0.15)' }} />
            <Text style={{ fontFamily: F.monoMed, fontSize: 10, color: C.textSecondary, marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>{name}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 26 }}><Eyebrow>Numerals · DM Mono</Eyebrow></View>
      <Text style={{ ...theme.typography.price, color: C.text, marginTop: 6 }}>₹3,720 · 4.9★ · 6h 00m</Text>
    </ScrollView>
  );
}

// ── Screen: Component kit ───────────────────────────────────────────────────
function KitScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 22, gap: 22 }} showsVerticalScrollIndicator={false}>
      <View>
        <Eyebrow>Buttons</Eyebrow>
        <View style={{ gap: 10, marginTop: 12 }}>
          <Button title="Primary — Request guide" onPress={() => {}} />
          <Button title="Secondary — Message" onPress={() => {}} variant="secondary" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Danger" onPress={() => {}} variant="danger" style={{ flex: 1 }} />
            <Button title="Ghost" onPress={() => {}} variant="ghost" style={{ flex: 1 }} />
          </View>
        </View>
      </View>

      <View>
        <Eyebrow>Status stamps</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <Badge label="Confirmed" variant="success" />
          <Badge label="Balance due" variant="warning" />
          <Badge label="Cancelled" variant="error" />
          <Badge label="You signed" variant="info" />
          <Badge label="Reconciling" variant="purple" />
          <Badge label="Completed" variant="neutral" />
        </View>
      </View>

      <View>
        <Eyebrow>Inputs</Eyebrow>
        <View style={{ marginTop: 12, gap: 12 }}>
          <Input label="Email" placeholder="you@example.com" value="" onChangeText={() => {}} />
          <Input label="Flight number" placeholder="EK 500" value="" onChangeText={() => {}} />
        </View>
      </View>

      <View>
        <Eyebrow>Cards</Eyebrow>
        <View style={{ marginTop: 12, gap: 12 }}>
          <Card>
            <Text style={{ fontFamily: F.displaySemi, fontSize: 16, color: C.text }}>Soft hairline card</Text>
            <Text style={{ fontFamily: F.body, fontSize: 13, color: C.textSecondary, marginTop: 4 }}>Default surface with an ink hairline and a gentle shadow.</Text>
          </Card>
          <Card framed elevation="none">
            <Text style={{ fontFamily: F.displaySemi, fontSize: 16, color: C.text }}>Framed “ticket” card</Text>
            <Text style={{ fontFamily: F.body, fontSize: 13, color: C.textSecondary, marginTop: 4 }}>Hard ink border, no shadow — for receipts and hero moments.</Text>
          </Card>
        </View>
      </View>
    </ScrollView>
  );
}

// ── Gallery ─────────────────────────────────────────────────────────────────
export default function DesignPreview() {
  const [showPass, setShowPass] = useState(false);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.background }} contentContainerStyle={{ padding: 28 }}>
      <Eyebrow>Detour · Mobile app</Eyebrow>
      <Text style={{ fontFamily: F.displayX, fontSize: 34, color: C.text, letterSpacing: -0.8, marginTop: 6, marginBottom: 4 }}>Warm Editorial — screen designs</Text>
      <Text style={{ fontFamily: F.body, fontSize: 15, color: C.textSecondary, marginBottom: 16, maxWidth: 720 }}>
        The marketing site’s palette and type, applied to the app: paper canvas, ink type, marigold / terracotta / sea accents, mono labels and numerals, hairline-bordered cards.
      </Text>
      <Pressable onPress={() => setShowPass(true)} style={{ alignSelf: 'flex-start', marginBottom: 22, backgroundColor: C.text, borderRadius: theme.borderRadius.md, paddingHorizontal: 18, paddingVertical: 12 }}>
        <Text style={{ fontFamily: F.bodyBold, color: '#FCF7EA', fontSize: 14 }}>▶  Play booking confirmation</Text>
      </Pressable>
      <BoardingPassReveal
        visible={showPass}
        itineraryName="First-time Mumbai classic"
        guideName="Aanya"
        guideAvatar="https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=120&q=80"
        dateLabel="14 Jun"
        timeLabel="08:30"
        flightNumber="EK 500"
        totalLabel="₹3,720"
        onDone={() => setShowPass(false)}
      />
      <View style={{ height: 1, backgroundColor: 'rgba(14,25,41,0.1)', marginBottom: 22 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingBottom: 12 }}>
        <Phone label="Type & Color"><SpecimenScreen /></Phone>
        <Phone label="Component kit"><KitScreen /></Phone>
        <Phone label="Explore"><ExploreScreen /></Phone>
        <Phone label="Guide profile"><GuideProfileScreen /></Phone>
        <Phone label="Itinerary"><ItineraryScreen /></Phone>
        <Phone label="Booking"><BookingScreen /></Phone>
        <Phone label="Trip detail"><TripDetailScreen /></Phone>
        <Phone label="Onboarding"><OnboardingScreen2 /></Phone>
      </ScrollView>
    </ScrollView>
  );
}
