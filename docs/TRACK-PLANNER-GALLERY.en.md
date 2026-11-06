# Track planner – new features in screenshots

[Deutsch](TRACK-PLANNER-GALLERY.de.md) · English · [Français](TRACK-PLANNER-GALLERY.fr.md)

Actual screenshots of the standalone planner captured on 6 November 2026, with the English interface and synthetic demo data only. All images are 1600 × 1400 pixels. The rail appearance was not altered for the captures.

Operation and technical limits: [planner tools](TRACK-PLANNER-TOOLS.md) (German). Source comparison: [review](TRACK-PLANNER-REVIEW-20261105.md) (German). Reproduction and verification: [gallery index](TRACK-PLANNER-GALLERY.md).

## 01. Create the start assembly

In an empty plan, the button creates a start/finish assembly with a Control Unit and two parallel fuel bays. It does not replace an existing layout. Plan changes can be undone.

![Create the start assembly](screenshots/track-planner/en/01-start-setup.png)

## 02. Start/finish, CU and two fuel bays

The inserted assembly contains six main modules and two FUEL positions. Move or rotate it as a group, or ungroup it when needed. Continue building from its open ends.

![Start/finish, CU and two fuel bays](screenshots/track-planner/en/02-start-cu-two-bays.png)

## 03. Readable lettering on a rotated CU

CU lettering remains readable after a 180° rotation. The housing, sensors and rails follow the rotation while the established rail appearance is retained.

![Readable lettering on a rotated CU](screenshots/track-planner/en/03-readable-rotated-cu.png)

## 04. Place a CU on an existing straight

Replace the selected 345 mm standard straight with a Control Unit and start/finish. Connections and neighbouring rails keep their positions, and the additional housing footprint is shown.

![Place a CU on an existing straight](screenshots/track-planner/en/04-cu-on-existing-straight.png)

## 05. Optional anti-collision marker

The installation flag is saved on the selected switch. The separate display option controls AKS marker visibility without removing that flag. A marker does not verify the actual electrical circuit.

![Optional anti-collision marker](screenshots/track-planner/en/05-optional-aks-marker.png)

## 06. Pit assistant: one bay on the other side

Preview the connection, fuel-bay count and pit side before applying. The other side uses unmirrored parts with reversed pit travel, which must be considered when physically building the layout.

![Pit assistant: one bay on the other side](screenshots/track-planner/en/06-pit-assistant-single-other-side.png)

## 07. Pit assistant: replace six existing modules

The preview places two fuel bays in a run of six aligned 345 mm straight modules on the same level. Protected groups, attachments and shoulders are not silently removed. Only applying the preview changes the plan.

![Pit assistant: replace six existing modules](screenshots/track-planner/en/07-pit-assistant-replace-six.png)

## 08. Connection and snap guidance

Select an open end to use as the insertion connection. The guide shows a 25.0 mm remaining gap and the required rotation. Green means compatible direction and level; snapping still requires sufficient proximity.

![Connection and snap guidance](screenshots/track-planner/en/08-connection-gap-direction.png)

## 09. Save and transfer assembly templates

Save the selected start assembly as a named browser template. Insert it at the chosen connection or transfer it through JSON export/import. Fuel/AKS metadata and relative levels are preserved; there is no automatic synchronization.

![Save and transfer assembly templates](screenshots/track-planner/en/09-assembly-templates.png)

## 10. Context menu on the part

Right-click a part to rotate, replace it with the selected catalogue part, ungroup, record AKS installation or delete. Available actions and their scope depend on the selection and grouping.

![Context menu on the part](screenshots/track-planner/en/10-context-menu.png)

## 11. Build check and missing parts

This deliberately invalid demo layout contains an overlap and an open pit connection. Its saved demo stock is explicitly empty, and missing quantities are calculated from it. No personal inventory data is shown.

![Build check and missing parts](screenshots/track-planner/en/11-build-check-and-missing-parts.png)

## 12. Highlight overlaps on the canvas

Selecting a finding marks the affected main rails in red so the problem can be located and edited. Stale highlights disappear after a plan change.

![Highlight overlaps on the canvas](screenshots/track-planner/en/12-highlighted-overlap.png)

## 13. Locate an open pit-part connection

The check also identifies open slot ends on native pit components. A red circle shows the open connection left by removing an entry. This complements the main-route check and does not replace electrical verification.

![Locate an open pit-part connection](screenshots/track-planner/en/13-open-pit-connection.png)

## 14. Repeat placement and fixed controls

Check “Repeat placement” in the catalogue and choose a rail. Its preview follows the mouse; each click places another copy. Nearby compatible ports snap together. R / Shift+R rotate the preview; Escape exits the mode. The track stays visible between the catalogue on the left and controls on the right, with independently scrolling sidebars. Small screens can open these panels below the track.

![Repeat placement and fixed controls](screenshots/track-planner/en/14-repeat-placement.png)

## 15. Replace directly and carry the following track

Select a rail and click another catalogue part to replace it immediately. The unambiguously connected following section rotates and shifts with the new outgoing end. The incoming end stays fixed. Repeat placement retains mouse stamping.

![Replace directly and carry the following track](screenshots/track-planner/en/15-replace-and-follow.png)

## 16. Choose the cut after replacement

Choose the cut in the right sidebar after replacing: immediately after the new part or after a following rail. Orange marks the separation. The section up to that point follows; the remaining track stays fixed. Each choice is recomputed from the original layout and supports undo.

![Choose the cut after replacement](screenshots/track-planner/en/16-choose-cut-point.png)

## 17. Join two track sections

Select one rail in each separate section with Ctrl/⌘+click. The first selected section stays fixed. Green and orange show the proposed connections; choose another pair in the connection selector. Free connection markers also support Ctrl/⌘+click selection.

![Join two track sections](screenshots/track-planner/en/17-join-sections-preview.png)

## 18. Align the complete following section

“Join sections” rotates and moves the entire second section until the selected ends meet. Internal geometry, groups and anchored extras stay together. Undo/redo is supported. If the other free ends also match, the circuit closes; otherwise the remaining gap stays visible.

![Align the complete following section](screenshots/track-planner/en/18-joined-sections.png)
