import {
  getGuideAvatar,
  getGuideHeroPhoto,
  getGuideJournalPhotos,
  getGuideStoryPhoto,
} from "@/config/photoLibrary";
import type { GuideProfile, GuideProfilePhoto } from "@/types";

function photo(
  id: string,
  role: GuideProfilePhoto["role"],
  url: string,
  position = 0,
): GuideProfilePhoto {
  return {
    id,
    guide_profile_id: "profile-1",
    role,
    storage_bucket: "itinerary-photos",
    storage_path: `gallery/guide-1/${id}.jpg`,
    url,
    caption: null,
    position,
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z",
  };
}

describe("structured guide profile photo placement", () => {
  const guide: Partial<GuideProfile> = {
    profile_id: "profile-1",
    id: "guide-1",
    name: "Aarav",
    avatar_url: "avatar",
    profile_photos: [
      photo("journal-b", "gallery", "journal-b", 1),
      photo("story", "story", "story"),
      photo("cover", "cover", "cover"),
      photo("journal-a", "gallery", "journal-a", 0),
    ],
  };

  it("keeps each declared role in exactly its own resolver", () => {
    expect(getGuideAvatar(guide)).toBe("avatar");
    expect(getGuideHeroPhoto(guide)).toBe("cover");
    expect(getGuideStoryPhoto(guide)).toBe("story");
    expect(getGuideJournalPhotos(guide).map((item) => item.url)).toEqual([
      "journal-a",
      "journal-b",
    ]);
  });

  it("does not fabricate identity or cover photos", () => {
    expect(getGuideAvatar({ id: "guide-2", name: "No Photo" })).toBeNull();
    expect(getGuideHeroPhoto({ id: "guide-2", name: "No Photo" })).toBeNull();
  });

  it("does not resurrect the legacy gallery when the structured journal is empty", () => {
    const migrated: Partial<GuideProfile> = {
      profile_id: "profile-migrated",
      gallery_urls: ["legacy-a", "legacy-b"],
      profile_photos: [],
    };

    expect(getGuideHeroPhoto(migrated)).toBeNull();
    expect(getGuideStoryPhoto(migrated)).toBeNull();
    expect(getGuideJournalPhotos(migrated)).toEqual([]);
  });
});
