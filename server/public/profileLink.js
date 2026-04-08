(function () {
  var PROFILE_USER_ID_KEY = 'healthCoachProfileUserId';

  function resolveProfileHref() {
    var params = new URLSearchParams(window.location.search);
    var fromQuery = params.get('userId') || params.get('id');

    if (fromQuery) {
      try {
        sessionStorage.setItem(PROFILE_USER_ID_KEY, fromQuery);
      } catch (e) {}
      return '/profile.html?id=' + encodeURIComponent(fromQuery);
    }

    try {
      var stored = sessionStorage.getItem(PROFILE_USER_ID_KEY);
      if (stored) {
        return '/profile.html?id=' + encodeURIComponent(stored);
      }
    } catch (e) {}

    return '/profile.html';
  }

  function wireProfileLinks() {
    var href = resolveProfileHref();
    var links = document.querySelectorAll('[data-profile-link]');

    for (var i = 0; i < links.length; i++) {
      links[i].href = href;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireProfileLinks);
  } else {
    wireProfileLinks();
  }
})();
