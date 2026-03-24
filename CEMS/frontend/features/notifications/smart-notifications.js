/**
 * Smart Notifications - Fetches and displays notifications on every dashboard load
 * Shows unread notifications as toasts when user lands on a dashboard
 */
(function() {
  const SHOWN_KEY = 'cems_notif_shown_';
  const MAX_TO_SHOW = 5;
  const DELAY_BETWEEN = 800;

  async function fetchAndShowNotifications() {
    const token = localStorage.getItem('cems_token');
    if (!token || typeof showToast !== 'function') return;

    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const notifs = await res.json();
      if (!Array.isArray(notifs)) return;

      const unread = notifs.filter(n => !n.read).slice(0, MAX_TO_SHOW);
      if (unread.length === 0) return;

      unread.forEach((n, i) => {
        const key = SHOWN_KEY + n._id;
        if (sessionStorage.getItem(key)) return;
        setTimeout(() => {
          showToast(n.message || 'New notification', n.type || 'info', 5000);
          sessionStorage.setItem(key, '1');
          fetch(`/api/notifications/${n._id}/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
          }).catch(() => {});
        }, i * DELAY_BETWEEN);
      });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(fetchAndShowNotifications, 500));
  } else {
    setTimeout(fetchAndShowNotifications, 500);
  }
})();
