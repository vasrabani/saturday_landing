// The four widths every change is checked at.
export const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812, touch: true },
  { name: 'tablet-768', width: 768, height: 1024, touch: true },
  { name: 'laptop-1024', width: 1024, height: 768, touch: false },
  { name: 'desktop-1440', width: 1440, height: 900, touch: false },
];

// Where the nav changes shape (chrome.css). The hamburger drawer shows up
// to 900px and the desktop links from 1025px; between them neither shows,
// which is a live-site bug tracked in features.spec.js.
export const DRAWER_NAV_MAX_WIDTH = 900;
export const DESKTOP_NAV_MIN_WIDTH = 1025;

export const showsDrawerNav = (page) => page.viewportSize().width <= DRAWER_NAV_MAX_WIDTH;
export const showsDesktopNav = (page) => page.viewportSize().width >= DESKTOP_NAV_MIN_WIDTH;
