# Amie — minimal iOS direction

System font stack uses SF Pro on Apple devices, with native system fallbacks elsewhere. No bundled proprietary font files.

Palette: background #f5f5f7, surface #ffffff, text #1d1d1f, secondary #6e6e73, separators #e5e5ea, accent #007aff.

Layout: iOS large titles, quiet grouped surfaces, 44px tap targets, restrained translucent bottom navigation, and a compact desktop sidebar. Left-aligned labels and explicit actions.

Remove decorative orbit art, handwritten type, pastel mood fills, and ornamental copy. Initial-based avatars and monochrome line icons keep the focus on the two people and their updates.

Mood icons use one SVG face silhouette, size, and rounded stroke. A smile means cheerful (Happy); heart eyes mean cared for and connected (Loved); a straight mouth means neutral or steady (Okay); closed eyes and a yawn mean low energy (Tired); a frown means feeling down (Low). Each face retains a visible label. The partner summary uses the same component with an accessible mood label. SVGs avoid platform-dependent emoji rendering; selection uses Amie's existing blue accent rather than a separate color for each mood.

Photo sharing opens a camera viewfinder with a centered shutter, a small gallery control at bottom left, and camera switching at bottom right. Capturing leads to a review with Retake, an optional caption, and an explicit Share photo action. Camera tracks stop on capture, closing the sheet, or leaving the app. When a live preview isn't available, the shutter opens the phone's camera and the gallery stays available.

Mobile Messages uses a full conversation: compact back/partner header, scrollable bubbles, and a composer above the keyboard. The app header and large title are hidden; bottom navigation hides while composing. Scrolling stays inside the conversation and preserves older messages while reading.

The Map tab follows the supplied dark Apple Maps reference: a full-screen muted street map, blue own-location dot, distinct partner pin, floating info/recenter controls, north-up compass, and a draggable dark bottom sheet with local people search. The OpenStreetMap attribution remains visible above the sheet. Map controls use the same system font and rounded line icons as Amie. Search never sends names to a map provider.
