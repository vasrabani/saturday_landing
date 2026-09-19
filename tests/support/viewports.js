// The four widths every change is checked at.
export const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812, touch: true },
  { name: 'tablet-768', width: 768, height: 1024, touch: true },
  { name: 'laptop-1024', width: 1024, height: 768, touch: false },
  { name: 'desktop-1440', width: 1440, height: 900, touch: false },
];

// Where the nav changes shape (chrome.css): the drawer covers everything
// below the desktop links, which start at 1280px, where the full link row
// fits. (site.js can also fall back to the drawer wider than that when a
// row does not fit; at these four widths it always does.)
export const DRAWER_NAV_MAX_WIDTH = 1279;
export const DESKTOP_NAV_MIN_WIDTH = 1280;

export const showsDrawerNav = (page) => page.viewportSize().width <= DRAWER_NAV_MAX_WIDTH;
export const showsDesktopNav = (page) => page.viewportSize().width >= DESKTOP_NAV_MIN_WIDTH;
