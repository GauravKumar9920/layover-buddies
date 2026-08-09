/**
 * Country picker with a search box.
 *
 * The nationality list went from sixteen hand-picked countries to the full ISO
 * 3166 set, which is only usable if you can type "neth" instead of thumbing
 * past two hundred rows. Everything that asks "where are you visiting from?"
 * goes through here so the search behaviour is the same in onboarding and in
 * the profile editor.
 *
 * The value is the country *name* (that is what `traveler_profiles.nationality`
 * stores), not the code — `canonicalNationality` maps legacy labels forward.
 */

import React, { useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { theme } from "@/config/theme";
import { hapticImpactMedium } from "@/lib/haptics";
import {
  NATIONALITY_OPTIONS,
  canonicalNationality,
} from "@/config/profileOptions";

/** Keeps rows a readable width when the app runs in a desktop browser. */
const SHEET_MAX_WIDTH = 560;

type Country = (typeof NATIONALITY_OPTIONS)[number];

/** "Curaçao" has to be reachable by typing "curacao" on an ASCII keyboard. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Rank matches so "ind" puts India above "British Indian Ocean Territory".
 * Word-start beats mid-word; the country code is matched too, so "US" and
 * "GB" work for people who think in codes.
 */
function search(query: string): readonly Country[] {
  const q = fold(query.trim());
  if (!q) return NATIONALITY_OPTIONS;

  const scored: { country: Country; score: number }[] = [];
  for (const country of NATIONALITY_OPTIONS) {
    const name = fold(country.name);
    let score = -1;
    if (name.startsWith(q)) score = 0;
    else if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(name))
      score = 1;
    else if (name.includes(q)) score = 2;
    else if (country.code.toLowerCase() === q) score = 0;
    if (score >= 0) scored.push({ country, score });
  }
  scored.sort(
    (a, b) => a.score - b.score || a.country.name.localeCompare(b.country.name),
  );
  return scored.map((entry) => entry.country);
}

interface NationalityPickerProps {
  value: string | null;
  onChange: (name: string) => void;
  label?: string;
  placeholder?: string;
}

export function NationalityPicker({
  value,
  onChange,
  label,
  placeholder = "Search for your country",
}: NationalityPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  const canonical = canonicalNationality(value);
  const selected = NATIONALITY_OPTIONS.find((c) => c.name === canonical);
  const results = useMemo(() => search(query), [query]);

  function choose(country: Country) {
    hapticImpactMedium();
    onChange(country.name);
    setOpen(false);
    setQuery("");
  }

  return (
    <View>
      {label ? (
        <Text
          style={{
            ...theme.typography.eyebrow,
            color: theme.colors.primary,
            marginBottom: 8,
          }}
        >
          {label}
        </Text>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Nationality. ${canonical ?? "Not set"}`}
        activeOpacity={0.75}
        onPress={() => {
          hapticImpactMedium();
          setOpen(true);
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          minHeight: 52,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderWidth: canonical ? 2 : 1,
          borderColor: canonical ? theme.colors.primary : theme.colors.divider,
          backgroundColor: canonical
            ? theme.colors.primaryLight
            : theme.colors.surface,
        }}
      >
        <Text style={{ fontSize: 24 }}>{selected?.flag ?? "🌍"}</Text>
        <Text
          style={{
            flex: 1,
            fontFamily: theme.fonts.bodySemi,
            fontSize: 15.5,
            color: canonical ? theme.colors.text : theme.colors.textMuted,
          }}
        >
          {canonical ?? placeholder}
        </Text>
        <Feather name="search" size={17} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent={false}
        onShow={() => inputRef.current?.focus()}
        onRequestClose={() => setOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              width: "100%",
              maxWidth: SHEET_MAX_WIDTH,
              alignSelf: "center",
              paddingHorizontal: 16,
              paddingTop: Platform.OS === "ios" ? 60 : 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.divider,
              backgroundColor: theme.colors.surface,
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: theme.colors.divider,
                backgroundColor: theme.colors.background,
              }}
            >
              <Feather
                name="search"
                size={16}
                color={theme.colors.textSecondary}
              />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (results.length > 0) choose(results[0]);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  fontFamily: theme.fonts.body,
                  fontSize: 15.5,
                  color: theme.colors.text,
                  // react-native-web renders this as an <input>, which draws
                  // its own focus ring on top of the container's border.
                  ...(Platform.OS === "web" ? { outline: "none" as never } : {}),
                }}
              />
              {query.length > 0 ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                setOpen(false);
                setQuery("");
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.bodySemi,
                  fontSize: 15,
                  color: theme.colors.primary,
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            contentContainerStyle={{
              width: "100%",
              maxWidth: SHEET_MAX_WIDTH,
              alignSelf: "center",
              padding: 16,
              gap: 8,
              paddingBottom: 48,
            }}
            ListEmptyComponent={
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 14,
                  color: theme.colors.textMuted,
                  textAlign: "center",
                  marginTop: 32,
                }}
              >
                No country matches “{query}”.
              </Text>
            }
            renderItem={({ item }) => {
              const isSelected = canonical === item.name;
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  activeOpacity={0.75}
                  onPress={() => choose(item)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    padding: 14,
                    borderRadius: 12,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected
                      ? theme.colors.primary
                      : theme.colors.divider,
                    backgroundColor: isSelected
                      ? theme.colors.primaryLight
                      : theme.colors.surface,
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{item.flag}</Text>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: theme.fonts.bodySemi,
                      fontSize: 15.5,
                      color: theme.colors.text,
                    }}
                  >
                    {item.name}
                  </Text>
                  {isSelected ? (
                    <Feather
                      name="check"
                      size={18}
                      color={theme.colors.primary}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}
