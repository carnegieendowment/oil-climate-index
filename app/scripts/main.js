/*global Oci, $*/

window.Oci = {
    Models: {},
    Collections: {},
    Views: {},
    Routers: {},
    init: function () {
        'use strict';

        Oci.getData();
        Oci.getPrices();
        Oci.router = new Oci.Routers.Router();
        Backbone.history.start();

    },
    getData: function () {
      'use strict';
      // synchronous AJAX call because the file is small and we need it to render all the graphs
      // technically we could start rending other things first and have the d3 trigger on load
      $.ajax({
        type: 'GET',
        url: './data/oils.json',
        dataType: 'json',
        success: function(data) {
          Oci.data = data;
        },
        async: false
      });
    },
    getPrices: function () {
      'use strict';

      $.ajax({
        type: 'GET',
        url: './data/prices.json',
        dataType: 'json',
        success: function(data) {
          Oci.prices = data;
        },
        async: false
      });
    },
    showPricesModal: function (tf) {
      'use strict';

      if (tf) {
        $('#modal-prices').addClass('revealed');
      } else {
        $('#modal-prices').removeClass('revealed');
      }
    },
    prices: {},
    data: {}
};

$(document).ready(function () {
    'use strict';
    Oci.init();


    // page nav dropdown behaviour on small screens
    $('[data-dropdown-nav]').click(function(e) {
      e.preventDefault();
      e.stopPropagation();
      $(this).parents('nav.page-nav').toggleClass('open');
    });

    $(document).click(function() {
      $('nav.page-nav').removeClass('open');
    });
});
