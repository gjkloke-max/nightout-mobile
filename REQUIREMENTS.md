# NightOut Mobile — Product Requirements

Platform-agnostic spec for implementing the full mobile app. Use this to drive both Cursor and future development.

---

## App Shell ✅

- [x] Bottom nav: Browse, Chat, Social, Profile
- [x] Header with notification bell (Social, Profile especially)
- [x] Design system: neutral palette (charcoal, slate, warm gray, taupe, cream)
- [x] Screen scaffolding with empty states

---

## Browse Tab

- Prominent search bar
- Discovery chips: "What's your vibe?", "Best date night", "Gluten-free options", "Cozy cocktails", "Best brunch nearby", "Worth the hype"
- Featured carousels / discovery modules
- Tappable venue cards → venue profile
- Loading skeletons, empty states

---

## Chat Tab (Concierge)

- Dedicated chat screen
- Empty state with suggested prompts
- Inline venue cards in responses
- Venue card actions: open profile, save, add to list
- Typing/loading state
- Preserve chat context when opening venue

---

## Social Tab

- User search at top
- Social feed (reviews from followed users)
- Post: reviewer, venue, rating, text, photos, like, comment
- Tap venue → profile; tap user → profile
- Public/private accounts, follow requests, locked profiles
- Empty state when not following anyone

---

## Profile Tab

- Avatar, display name, username, home neighborhood
- Follower/following counts, review count, list count
- Edit profile, avatar upload
- CTA: "Write a Review"
- Top 10 preview, Lists preview
- Tabs: Reviews, Lists, Saved, Preferences, (Activity)

---

## Notifications

- Bell icon in header
- Types: follow requests, accepted/denied, likes, comments
- Real user identity (never "someone")
- Deep-link to destination
- Read/unread state

---

## Venue Profile

- Horizontal photo gallery, tap for full viewer
- Name, editorial summary (~40 words)
- Save, add to list, review, website, address
- Crowd Sentiment section
- Review area
- Fallbacks: no photos, no summary, sparse reviews

---

## Review Creation

- Entry points: profile CTA, venue profile, saved
- Flow: select venue → rating → text → photos → post
- Appears in feed, updates Top 10

---

## Lists / Saved / Top 10

- Saved places
- User-created lists (playlist feel)
- Live Top 10 from user's reviews
- Add-to-list from venue cards/pages
- List detail pages, create-list flow

---

## Social Mechanics

- Public/private accounts
- Private: follow requests required
- Locked profile shell for non-approved viewers
- Comments show real identity
- Accepted follows backfill feed

---

## Polish

- Loading skeletons
- Empty states
- Toasts: saved, added to list, follow requested, etc.
- Optimistic updates
- Clear error states, retry
- Large tap targets
- Image loading/fallback

---

## Backend

Uses existing NightOut backend:
- Supabase: auth, venues, reviews, lists, social, notifications
- Search API: concierge, venue search (Node server in main repo)
