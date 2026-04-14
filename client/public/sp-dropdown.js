// Street Profile — avatar click navigates directly to profile
// No longer injects a dropdown menu item; instead makes the avatar icon
// beside the user's name navigate to Street Profile on click.
(function() {
  var ATTR = 'data-sp-avatar-v4';

  setInterval(function() {
    try {
      // Find the account settings button (the avatar + name at bottom-left)
      var btn = document.querySelector('[data-testid="nav-user"]');
      if (!btn) return;

      // Find the avatar container (first child div with the image)
      var avatarWrap = btn.querySelector('div > div.relative');
      if (!avatarWrap) return;
      if (avatarWrap.getAttribute(ATTR)) return;
      avatarWrap.setAttribute(ATTR, '1');

      // Style it as clickable
      avatarWrap.style.cursor = 'pointer';
      avatarWrap.style.borderRadius = '50%';
      avatarWrap.style.transition = 'box-shadow 0.2s';

      avatarWrap.addEventListener('mouseenter', function() {
        avatarWrap.style.boxShadow = '0 0 0 2px #eab308';
      });
      avatarWrap.addEventListener('mouseleave', function() {
        avatarWrap.style.boxShadow = 'none';
      });

      avatarWrap.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = '/settings';
      });
    } catch(e) {
      // silent
    }
  }, 300);
})();
