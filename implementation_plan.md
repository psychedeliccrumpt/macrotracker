
## New Feature: Macro Detailed View

### Goal
Provide users with a breakdown of which foods are contributing most to their daily Protein, Carbs, and Fat totals when they click the macro cards on the Dashboard.

### Proposed Changes
#### components/Dashboard.tsx
- Add selectedMacro state ('protein' | 'carbs' | 'fat' | null).
- Wrap macro breakdown cards in button or add onClick handlers with cursor-pointer.
- Implement a modal or overlay that:
    - Lists all foods logged today.
    - Highlights the specific macro value for each food.
    - Sorts by the amount of that macro (highest first).

#### App.tsx
- Ensure the targets passed to Dashboard are balanced and correct.

## Feature: Automatic Unit Conversion in EditorModal

### Goal
When a food has a weight-based serving size (e.g., 1 serving = 110g), the EditorModal should automatically convert quantities and macros when switching between units.

### Proposed Changes
#### components/EditorModal.tsx
- Add logic to extract weight (grams/ml) from the servingSize string.
- Store gramsPerServing in state.
- Update handleUnitChange to calculate the new quantity based on the weight ratio.
- Improve macro calculation to correctly handle unit context.

## Feature: Logout Functionality

### Goal
Provide a way for users to log out of their account from the 'My' page.

### Proposed Changes
#### components/MyPage.tsx
- Add a 'Log Out' button to the header or settings tab.
- Implement a handleLogout function using supabase.auth.signOut().

## Feature: Enhanced Neobrutalist Macro Detailed View

### Goal
Push the neobrutalist aesthetic of the Macro Detailed View further to match the high-impact style of the login page and dashboard.

### Proposed Changes
#### components/Dashboard.tsx (MacroDetailModal)
- Increase border thickness of the modal and list items.
- Add more dramatic offset shadows to the modal and list cards.
- Use high-contrast color blocks and font-black weights for better hierarchy.
- Add stylized labels and decorative geometric elements (like the login page).
