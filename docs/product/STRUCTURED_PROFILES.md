# Structured Profiles

Status: implemented foundation
Surfaces: iPhone app, mobile web preview
Roles: Traveler and Buddy (guide)

## The problem

The old Buddy editor saved every uploaded image to one `gallery_urls` array.
The public profile then independently reused that same array for the cover
carousel, interview quote, prompt cards, day timeline, and photo journal.
Different exclusion rules made a single upload appear to move around the page.

That is a content-model problem, not a grid-layout problem. A thumbnail gallery
with better styling would still leave the app guessing what every image means.

The old profiles also mixed unrelated responsibilities:

- `is_active` meant both "profile is ready to show" and "accepting inquiries."
- Traveler identity, a repeatable layover, and private safety data lived in one
  row with one broad access policy.
- Empty Buddy story fields were replaced with fabricated first-person copy.
- Stock portraits were presented as if they belonged to real people.

## Product principles

1. **One item, one job.** Every photo has a declared destination.
2. **Identity is not editorial media.** A face photo is never a cover or a tour
   photo unless its owner deliberately uploads it into that separate slot.
3. **Trip context is repeatable.** A layover is not permanent traveler identity.
4. **Private means enforced in data access.** Safety copy in the UI must match
   Row Level Security.
5. **Incomplete is honest.** Hide empty sections and show setup guidance; never
   invent a person's words, face, or experience.
6. **Draft and availability are different.** Publishing controls discovery;
   accepting inquiries controls current availability.

## Media contract

| Media              | Owner                               | Appears in                                    | Never auto-used in              |
| ------------------ | ----------------------------------- | --------------------------------------------- | ------------------------------- |
| Avatar             | `users.avatar_url`                  | Requests, chat, reviews, small identity marks | Cover, story, tour, journal     |
| Profile cover      | `guide_profile_photos.role=cover`   | Buddy card and public-profile lead image      | Story, prompts, timeline, tour  |
| Story image        | `guide_profile_photos.role=story`   | Interview quote only                          | Cover, timeline, journal        |
| Journal item       | `guide_profile_photos.role=gallery` | Ordered/captioned profile journal only        | Cover, story, tour, stop        |
| Tour cover/gallery | `itineraries`                       | That tour                                     | General Buddy profile placement |
| Stop photo         | `itinerary_stops`                   | That exact stop                               | Profile or unrelated stops      |

Traveler profiles deliberately have one identity avatar and no public gallery.
A future shared trip album belongs to a completed trip, not to either person's
profile.

## Buddy builder

The editor is a sequence of field-note sections:

1. **Identity** — face photo, name, university, hometown, languages.
2. **Cover story** — one clearly labelled cover, bio, headline quote, and one
   optional story image.
3. **In their own words** — three guided answers.
4. **Photo journal** — ordered walk photos with captions and move controls.
5. **Review and publish** — traveler preview and a completeness checklist.

Publishing requires the trust/content essentials: real name, face photo, cover,
bio, at least one language, university, and at least one real story answer.
Photo-journal items are recommended rather than required. A published Buddy can
separately pause or resume accepting inquiries.

Publication and availability can be changed only through validated database
functions. If a published edit removes a required trust field or the cover, the
profile atomically returns to draft and pauses new inquiries. A paused published
profile remains directly viewable with its photos, but it is absent from
Explore and has no inquiry actions.

## Traveler builder

Traveler setup is role-specific:

1. **Current Mumbai layover** — arrival, departure, inbound/outbound flight, and
   group size. This lives in `traveler_layovers`, allowing later visits.
2. **About you** — avatar, name, nationality, language, and a short note.
3. **Your kind of Detour** — interests, pace, food preferences, and optional
   access notes.
4. **Safety details** — optional gender and emergency contact in
   `traveler_safety_profiles`.
5. **What your Buddy sees** — a plain-language preview of shared versus private
   fields.

Safety rows are owner-readable and become Buddy-readable only for
`trip_ready`/`in_progress` bookings. The active layover remains owner-managed;
booking and agreement records hold their own trip snapshots.

Returning travelers can choose **Plan another layover**. One transaction
archives the previous active layover and creates the new BOM window; past
bookings remain unchanged. The Buddy request/detail surfaces show the planning
brief, while safety details are queried separately and only on an eligible
trip-day status. Emergency contact remains optional.

## Lifecycle and compatibility

- New Buddy profiles start `draft` and not accepting inquiries.
- Existing active profiles are grandfathered to `published` so rollout does not
  remove the current catalogue.
- Legacy `gallery_urls` entries migrate, in order, to journal items. The system
  does not guess that an old image was a cover or story image.
- The legacy array remains read-only compatibility data for one release.
- `profile_status` controls discovery; `is_active` controls availability.
- Existing traveler layover/safety values migrate to their dedicated tables and
  are cleared from the broad legacy columns.
- Database constraints keep those retired broad columns empty so an older
  client cannot recreate the former safety-data exposure.

## Acceptance checks

- Adding photo A as cover never displays A in story, prompts, timeline, or
  journal.
- Adding photo B as story never displays B in cover or journal.
- Journal order and captions survive save, reload, and iPhone multi-select.
- Deleting the final journal item does not resurrect the retired gallery array.
- Timeline images come only from ordered itinerary stops.
- Missing avatars render initials, never a stock person's face.
- Missing story fields produce no public first-person claims.
- Draft Buddies are owner-previewable but absent from Explore/search.
- Emergency contact is inaccessible to a Buddy outside an active trip.
- Creating a second layover archives the first active row and preserves booking
  snapshots.
- Traveler and Buddy builders both communicate completion and photo usage before
  upload.
