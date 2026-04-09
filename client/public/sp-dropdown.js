// Street Profile dropdown override - navigates to user's own creative profile page
(function() {
  var SP_ID = 'sv-street-profile-menuitem';
  var cachedUsername = null;

  // Fetch the current user's username from the API
  function fetchUsername(cb) {
    if (cachedUsername) return cb(cachedUsername);
    fetch('/api/user', { credentials: 'include' })
      .then(function(res) { return res.ok ? res.json() : null; })
      .then(function(data) {
        if (data && data.username) {
          cachedUsername = data.username;
          cb(data.username);
        } else {
          // Fallback: try to read from the settings page handle display
          cb(null);
        }
      })
      .catch(function() { cb(null); });
  }

  setInterval(function() {
    try {
      var popover = document.querySelector('.account-settings-popover');
      if (!popover) return;

      // Check if we already injected or need to override
      var existing = popover.querySelector('#' + SP_ID);
      if (existing && existing.getAttribute('data-sp-v3')) return;

      // If existing item from old code, remove it so we can re-inject
      if (existing) existing.remove();

      var items = popover.querySelectorAll('.select-item');
      var settingsItem = null;
      for (var i = 0; i < items.length; i++) {
        if (items[i].textContent.trim().indexOf('Settings') !== -1) {
          settingsItem = items[i];
          break;
        }
      }
      if (!settingsItem) return;

      // Clone the Settings item style
      var spItem = settingsItem.cloneNode(true);
      spItem.id = SP_ID;
      spItem.setAttribute('data-sp-v3', '1');
      spItem.innerHTML = '';

      // Icon
      var iconWrap = document.createElement('div');
      iconWrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-md"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
      spItem.appendChild(iconWrap.firstChild);

      var label = document.createElement('span');
      label.textContent = 'Street Profile';
      spItem.appendChild(label);

      spItem.style.cursor = 'pointer';
      spItem.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        fetchUsername(function(username) {
          if (username) {
            window.location.href = '/creatives/' + encodeURIComponent(username);
          } else {
            // Fallback to settings if username unavailable
            window.location.href = '/settings';
          }
        });
      };

      settingsItem.parentNode.insertBefore(spItem, settingsItem);
    } catch(e) {
      // silent
    }
  }, 300);
})();
