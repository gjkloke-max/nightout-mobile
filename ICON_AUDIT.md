# Icon Audit — Lucide React Native

## Summary

All icons have been standardized on `lucide-react-native`. Custom SVG tab icons and emoji placeholders have been replaced with Lucide equivalents.

## Icon Mapping

| Context | Previous | Lucide Icon | Size |
|---------|----------|-------------|------|
| **Bottom nav** | Custom SVGs | Compass, MessageCircle, Users, User | nav (24) |
| **Header** | Bell SVG | Bell | header (22) |
| **Notifications** | — | Bell (in TabNavigator header) | header |
| **Venue Save** | 🔖 / ♡ | Bookmark (filled when saved) | button |
| **Add to List** | + text | ListPlus | xs |
| **Review** | 💬 text | MessageSquare | xs |
| **Location** | ✈️ | Send (maps/directions) | inline |
| **Website** | 🌐 | Globe | inline |
| **Image placeholder** | 📷 | Image | 48 / 40 |
| **Venue placeholder** | 📍 | MapPin | card |
| **Like** | ❤️ / ♡ | Heart (filled when liked) | card |
| **Comment** | 💬 | MessageCircle | card |
| **More options** | ⋯ | MoreHorizontal | card |
| **Write Review** | ✍️ | Pencil | inline |
| **Avatar add** | + | Plus | 14 |
| **Profile location** | 📍 | MapPin | inline |
| **Search** | — | Search | inline |
| **Close** | × | X | card / header |
| **Chat send** | "Send" text | Send | button |

## Sizing Convention (`src/theme/icons.js`)

- **nav** (24): Bottom tab bar
- **header** (22): Top bar, header actions
- **button** (20): Primary action buttons
- **card** (18): Card metadata, list items
- **inline** (16): Inline with text
- **xs** (14): Small badges, chips

## Flagged for Review

1. **Tab icons vs Figma**: The app previously used custom Figma SVGs (compass, chat bubble, people, profile) for the bottom nav. Lucide equivalents (Compass, MessageCircle, Users, User) are semantically correct but may differ slightly in visual style. If pixel-perfect Figma match is required, consider keeping the SVG tab icons and using Lucide everywhere else.

2. **Send vs paper plane**: The design showed a paper airplane for "open in maps". Lucide's `Send` icon is a paper plane. Used for both maps link and chat send.

3. **Bookmark vs Heart for Save**: The venue "Save" action uses Bookmark (saves to favorites). The social feed "Like" uses Heart. This distinction is intentional.
