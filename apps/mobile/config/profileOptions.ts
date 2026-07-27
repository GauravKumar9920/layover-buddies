/** One canonical taxonomy for onboarding, profile editing, and matching. */

export const GENDER_OPTIONS = [
  { key: "female", label: "Female" },
  { key: "male", label: "Male" },
  { key: "non_binary", label: "Non-binary" },
  { key: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export const INTEREST_OPTIONS = [
  { key: "food", label: "Food & Street Eats", emoji: "🍜" },
  { key: "history", label: "History & Heritage", emoji: "📚" },
  { key: "photography", label: "Photography Spots", emoji: "📸" },
  { key: "culture", label: "Culture & Arts", emoji: "🎭" },
  { key: "nightlife", label: "Nightlife", emoji: "🌙" },
  { key: "hidden gems", label: "Hidden Gems", emoji: "💎" },
  { key: "adventure", label: "Adventure", emoji: "🧗" },
  { key: "shopping", label: "Shopping & Markets", emoji: "🛍️" },
  { key: "architecture", label: "Architecture", emoji: "🏛️" },
  { key: "bollywood", label: "Bollywood", emoji: "🎬" },
] as const;

export const TRAVEL_PACE_OPTIONS = [
  {
    key: "relaxed",
    label: "Relaxed",
    description: "Fewer stops, more time to linger.",
    icon: "coffee",
  },
  {
    key: "balanced",
    label: "Balanced",
    description: "A comfortable mix of seeing and pausing.",
    icon: "compass",
  },
  {
    key: "packed",
    label: "Make it count",
    description: "Fit in more while the clock allows.",
    icon: "zap",
  },
] as const;

export const DIETARY_OPTIONS = [
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "halal", label: "Halal" },
  { key: "no_beef", label: "No beef" },
  { key: "no_pork", label: "No pork" },
  { key: "gluten_free", label: "Gluten-free" },
  { key: "nut_allergy", label: "Nut allergy" },
] as const;

export const NATIONALITY_OPTIONS = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "AE", name: "UAE", flag: "🇦🇪" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "OT", name: "Other", flag: "🌍" },
] as const;
