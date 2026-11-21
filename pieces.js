/* Shaxmat donalari: o'zim chizgan SVG (45x45). Ranglar CSS o'zgaruvchilari orqali (.pc.w / .pc.b). */
(function (root) {
  'use strict';
  var P = {
    p:
      '<circle class="f s" cx="22.5" cy="13" r="5.3"/>' +
      '<rect class="f s" x="16.2" y="19.4" width="12.6" height="3.2" rx="1.6"/>' +
      '<path class="f s" d="M18.4 22.6c0 5-2.4 8-5 11.4h18.2c-2.6-3.4-5-6.4-5-11.4z"/>' +
      '<rect class="f s" x="11.2" y="33.8" width="22.6" height="4.8" rx="2"/>',
    r:
      '<path class="f s" d="M13 10.5h4.6v3.2h3.1v-3.2h3.6v3.2h3.1v-3.2H32v8.2H13z"/>' +
      '<path class="f s" d="M15.2 18.7h14.6l1.4 14.4H13.8z"/>' +
      '<path class="d" d="M17.5 24.5h10"/>' +
      '<rect class="f s" x="11.2" y="33.1" width="22.6" height="5.4" rx="1.8"/>',
    b:
      '<circle class="f s" cx="22.5" cy="6.6" r="2.3"/>' +
      '<path class="f s" d="M22.5 8.4c4.6 3.9 7.2 8.2 7.2 12.1 0 2.8-2.7 4.5-7.2 4.5s-7.2-1.7-7.2-4.5c0-3.9 2.6-8.2 7.2-12.1z"/>' +
      '<path class="d" d="M19.6 17.4l5.8-5.6"/>' +
      '<rect class="f s" x="14.6" y="24.4" width="15.8" height="3.2" rx="1.6"/>' +
      '<path class="f s" d="M17.6 27.6c0 3.2-1.9 5.2-4.2 6.4h18.2c-2.3-1.2-4.2-3.2-4.2-6.4z"/>' +
      '<rect class="f s" x="11.2" y="33.9" width="22.6" height="4.7" rx="2"/>',
    n:
      '<path class="f s" d="M13.2 33.8c0-7.4 3.6-10.8 6.3-14.3-2 .8-3.9 2.2-5.6 3.5l-3.4-2.6c-.5-2.4 1.1-4.4 2.8-6.6 1.4-1.8 2.3-3.6 2.1-5.8l3 .9 1.9-4 2.7 3.2c7.2.7 11.7 6.5 11.7 15.6l-.8 10.1z"/>' +
      '<circle class="d" cx="19.6" cy="15.6" r="1.1"/>' +
      '<path class="d" d="M25.4 13.8c3.7 2.8 5 7 4.6 12.2"/>' +
      '<rect class="f s" x="11.2" y="33.8" width="22.6" height="4.8" rx="2"/>',
    q:
      '<circle class="f s" cx="11.4" cy="11.2" r="2.2"/><circle class="f s" cx="17" cy="8" r="2.2"/>' +
      '<circle class="f s" cx="22.5" cy="7" r="2.2"/><circle class="f s" cx="28" cy="8" r="2.2"/><circle class="f s" cx="33.6" cy="11.2" r="2.2"/>' +
      '<path class="f s" d="M10.8 13.4l4.8 12.6h13.8l4.8-12.6-5.4 7-2.6-9.6-4 9-4-9-2.6 9.6z"/>' +
      '<rect class="f s" x="14.2" y="26" width="16.6" height="3.4" rx="1.7"/>' +
      '<path class="f s" d="M16.4 29.4c0 2.6-1.4 4-3 5.2h18.2c-1.6-1.2-3-2.6-3-5.2z"/>' +
      '<rect class="f s" x="10.8" y="34.6" width="23.4" height="4.4" rx="2"/>',
    k:
      '<rect class="f s" x="20.9" y="3.2" width="3.2" height="10.4" rx="1"/>' +
      '<rect class="f s" x="17.9" y="6.2" width="9.2" height="3.2" rx="1"/>' +
      '<path class="f s" d="M22.5 13.4c-8.4 0-11.6 6.6-9.1 11.6 1 2 3 2.6 3 2.6h12.2s2-.6 3-2.6c2.5-5-.7-11.6-9.1-11.6z"/>' +
      '<path class="d" d="M17.2 22.4c3.4 1.8 7.4 1.8 10.8 0"/>' +
      '<rect class="f s" x="14.2" y="27.6" width="16.6" height="3.4" rx="1.7"/>' +
      '<path class="f s" d="M16.4 31c0 2.2-1.4 3.4-2.9 4.2h18c-1.5-.8-2.9-2-2.9-4.2z"/>' +
      '<rect class="f s" x="10.8" y="35" width="23.4" height="4.2" rx="2"/>'
  };
  root.pieceSVG = function (ch) {
    var white = ch < 'a';
    return '<svg class="pc ' + (white ? 'w' : 'b') + '" viewBox="0 0 45 45" aria-hidden="true">' + P[ch.toLowerCase()] + '</svg>';
  };
})(typeof self !== 'undefined' ? self : this);
