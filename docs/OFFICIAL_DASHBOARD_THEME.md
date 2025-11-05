# Official Dashboard Theme - VERBATIM REQUIRED

This document defines the **official theme** for the Shri O.P. Choudhary Social Media Analytics Dashboard. **ALL components MUST use these colors verbatim - no compromises.**

## CSS Custom Properties (Root Variables)

```css
:root {
  /* Official Dashboard Theme - VERBATIM REQUIRED */
  --gradient-bg: linear-gradient(135deg, #5D3FD3 0%, #8B1A8B 100%);
  --card-bg: rgba(177, 156, 217, 0.7);
  --nav-bg: #D8BFD8;
  --text-primary: #FFFFFF;
  --approved: #32CD32;
  --pending: #FFD700;
  --rejected: #FF4500;
  --warning: #FF4500;
  --active-tab: #4169E1;
}
```

## Color Usage Guidelines

### Background
- **Main Background**: Use `--gradient-bg` for the body background
- **Cards/Containers**: Use `--card-bg` for glassmorphic cards
- **Navigation**: Use `--nav-bg` for navigation elements

### Text
- **Primary Text**: Use `--text-primary` (#FFFFFF) for all text

### Status Colors
- **Approved**: Use `--approved` (#32CD32) for approved items
- **Pending**: Use `--pending` (#FFD700) for pending items
- **Rejected**: Use `--rejected` (#FF4500) for rejected/error items
- **Warning**: Use `--warning` (#FF4500) for warning states

### Interactive Elements
- **Active Tab**: Use `--active-tab` (#4169E1) for active navigation tabs
- **Primary Buttons**: Use #5D3FD3 (first gradient color)
- **Secondary Buttons**: Use `--nav-bg` (#D8BFD8)

## Implementation Notes

1. **NO COMPROMISES**: All components must use these exact colors
2. **Tailwind Classes**: Custom utility classes have been created for these colors
3. **CSS Variables**: Use CSS custom properties for dynamic theming
4. **Hex Values**: Use exact hex codes for static styling
5. **Gradient**: The background gradient must be exactly `linear-gradient(135deg, #5D3FD3 0%, #8B1A8B 100%)`

## Files Updated

- `src/app/globals.css`: Root CSS variables and utility classes
- `tailwind.config.ts`: Tailwind custom colors and utilities
- `src/components/ui/Button.tsx`: Button component theme colors
- `src/components/auth/AdminLoginButton.tsx`: Login/logout button colors

## Vercel Deployment

Vercel will deploy ONLY this theme. Any deviations will be rejected during CI/CD.

---

**VERIFICATION**: Run the dashboard and ensure all elements use the exact colors specified above.
