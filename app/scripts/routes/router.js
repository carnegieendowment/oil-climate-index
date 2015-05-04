/*global Oci, Backbone*/

Oci.Routers = Oci.Routers || {};

(function () {
    'use strict';

    var demoViewDuration = 5000;

    Oci.Routers.Router = Backbone.Router.extend({

      initialize: function () {
        // Create prices view
        new Oci.Views.Prices();
      },

      routes: {
        '' : 'supplyCurve',
        'compare' : 'compareOils',
        'emissions' : 'emissionsDrivers',
        'oil/:id' : 'oilDetails',
        'demo' : 'playDemo'
      },

      playDemo: function() {
        var self = this;

        var index = 0;
        var showView = function () {
          switch(index) {
            case 0:
              self.execute(self.supplyCurve, [null]);
              break;
            case 1:
              self.execute(self.compareOils, [null]);
              break;
            case 2:
              self.execute(self.emissionsDrivers, [null]);
              break;
            case 3:
              self.execute(self.oilDetails, ['us-alaskan-north-slope', null]);
              break;
          }
          setTimeout(function () {
            index = (index + 1) % 4;
            showView();
          }, demoViewDuration);
        };
        showView();
      },

      execute: function(callback, args) {
        this.allRoutes();
        if (callback) {
          callback.apply(this, args);
        }
      },

      supplyCurve: function() {
        Oci.view = new Oci.Views.SupplyCurve();
        $('#menu-supply').addClass('active');
      },

      compareOils: function() {
        Oci.view = new Oci.Views.CompareOils();
        $('#menu-compare').addClass('active');
      },

      emissionsDrivers: function() {
        Oci.view = new Oci.Views.EmissionsDrivers();
        $('#menu-emissions').addClass('active');
      },

      oilDetails: function(id) {
        Oci.view = new Oci.Views.OilDetails({oil: id});
        $(window).scrollTop(0);
      },

      allRoutes: function() {
        if (Oci.view){
          $('body').unbind();
          $(window).off('resize');
          Oci.view.undelegateEvents();
          // Remove old tooltips
          $('.d3-tip').remove();
          // Unset active states for header items
          $('#menu-block li').removeClass('active');
          $('#menu-supply').removeClass('active');
        }
        // sends page information to google analytics
        ga('send','pageview', window.location.hash);
      }

    });

})();
