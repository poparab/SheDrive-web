/**
 * page-banner.js — first load of a detail screen, with a banner if it fails.
 *
 * List screens already show a failed load inside their grid (ad-data-table's
 * error state). A detail screen has no grid, so a failed first load used to
 * leave a blank page. This runs the screen's load() and, if it rejects, hides
 * the record and shows a danger banner with Retry — the state persists until
 * a retry succeeds, which is what makes it a banner rather than a toast.
 */

import { t } from './admin-i18n.js';

/**
 * @param {() => Promise<void>} load  the screen's own loader
 * @param {{ banner: HTMLElement, hide: HTMLElement[] }} targets
 *   banner — the screen's <ad-banner>; hide — the record body and not-found block
 */
export async function loadWithBanner(load, { banner, hide = [] }) {
  try {
    await load();
  } catch (error) {
    hide.forEach((node) => {
      if (node) node.hidden = true;
    });
    banner.show({
      tone: 'danger',
      heading: t('banner.loadFailedHeading'),
      message: t('banner.loadFailedMessage', { message: error?.message ?? t('toast.actionFailed') }),
      action: {
        label: t('toast.retry'),
        onClick: () => {
          banner.hide();
          loadWithBanner(load, { banner, hide });
        },
      },
    });
  }
}
