/*global Oci*/

Oci.Views = Oci.Views || {};

(function () {
    'use strict';

    var self;
    var flaringValues;
    var flaringLabels;
    var steamValues;
    var steamLabels;
    var waterValues;
    var waterLabels

    Oci.Views.ModelParameters = Backbone.View.extend({

        template: JST['app/scripts/templates/modelparameters.ejs'],

        el: '#model-parameters',

        events: {
          'click .toggle': 'toggleModelParameters',
          'change input': 'updateSummary',
          'change .slider': 'updateSummary',
          'change select': 'updateSummary'
        },

        initialize: function () {
          self = this;
          this.setSliders();
        },

        render: function () {
          this.$el.html(this.template());
          this.addSliders();
          this.updateSummary();
          this.$('[data-toggle="tooltip"]').tooltip();
        },

        getModelValues: function () {
          return {
            water: ($('#slider-water').val() / 100),
            steam: ($('#slider-steam').val() / 100),
            flaring: ($('#slider-flaring').val() / 100),
            refinery: $('#dropdown-refinery').val(),
            showCoke: $('#toggle-petcoke').is(':checked')
          };
        },

        // Used to set values on load
        setModelParameters: function (params) {
          if (params.opgee) {
            try {
              // We know the format of the param 'run###'
              var water = params.opgee[3];
              var steam = params.opgee[4];
              var flaring = params.opgee[5];
              var value = parseFloat(Oci.data.metadata.water.split(',')[water]) * 100;
              $('#slider-water').val(value);
              value = parseFloat(Oci.data.metadata.steam.split(',')[steam]) * 100;
              $('#slider-steam').val(value);
              value = parseFloat(Oci.data.metadata.flare.split(',')[flaring]) * 100;
              $('#slider-flaring').val(value);
            } catch (e) {
              console.warn('bad input parameter');
            }
          }

          if (params.prelim) {
            try {
              // We know the format of the param 'run#'
              var refinery = params.prelim[3];
              $('#dropdown-refinery').prop('selectedIndex', refinery);
            } catch (e) {
              console.warn('bad input parameter', e);
            }
          }

          if (params.showCoke !== undefined) {
            if (params.showCoke === 'false') {
              $('#toggle-petcoke').attr('checked', false);
            } else if (params.showCoke === 'true') {
              $('#toggle-petcoke').attr('checked', true);
            }
          }

          self.updateSummary();
        },

        updateSummary: function () {
          var flaring = parseInt($('#slider-flaring').val());
          $('.value.flare span').html(flaring + '%');
          var water = parseInt($('#slider-water').val());
          $('.value.water span').html(water + '%');
          var steam = parseInt($('#slider-steam').val());
          $('.value.steam span').html(steam + '%');
          var petcoke = $('#toggle-petcoke').is(':checked') ? 'On' : 'Off';
          $('.value.petcoke span').html(petcoke);
          var refinery = $('#dropdown-refinery').val();
          switch(refinery) {
            case '0 = Default':
              refinery = 'Default';
              break;
            case '1 = Hydroskimming':
              refinery = 'Hydro';
              break;
            case '2 = Medium Conversion':
              refinery = 'Medium';
              break;
            case '3 = Deep Coking':
              refinery = 'Deep Coke';
              break;
            case '4 = Deep Hydrotreating':
              refinery = 'Deep Hydro';
              break;
          }
          $('.value.refinery span').html(refinery);
        },

        addSliders: function () {
          // Temp model parameter sliders
          $('#slider-flaring').noUiSlider({
            start: 100,
            connect: 'lower',
            snap: true,
            range: _.object(flaringLabels, flaringValues)
          });
          $('#slider-flaring').noUiSlider_pips({
            mode: 'values',
            values: flaringValues,
            density: 10,
            format: wNumb({
		            postfix: '%'
	          }),
            stepped: true
          });

          $('#slider-steam').noUiSlider({
            start: 100,
            connect: 'lower',
            snap: true,
            range: _.object(steamLabels, steamValues)
          });
          $('#slider-steam').noUiSlider_pips({
            mode: 'values',
            values: steamValues,
            density: 10,
            format: wNumb({
		            postfix: '%'
	          }),
            stepped: true
          });

          $('#slider-water').noUiSlider({
            start: 100,
            connect: 'lower',
            snap: true,
            range: _.object(waterLabels, waterValues)
          });
          $('#slider-water').noUiSlider_pips({
            mode: 'values',
            values: waterValues,
            density: 10,
            format: wNumb({
		            postfix: '%'
	          }),
            stepped: true
          });
        },

        toggleModelParameters: function (e) {
          e.preventDefault();
          $('#model-parameters').toggleClass('open');
        },

        // set the slider options based on the metadata
        setSliders: function () {
          var m = Oci.data.metadata;

          flaringValues = m.flare.split(',').map(function(val) { return Number(val) * 100; });
          steamValues = m.steam.split(',').map(function(val) { return Number(val) * 100; });
          waterValues = m.water.split(',').map(function(val) { return Number(val) * 100; });

          flaringLabels = this.sliderHelper(flaringValues);
          steamLabels = this.sliderHelper(steamValues);
          waterLabels = this.sliderHelper(waterValues);
        },

        // helper function for setSliders
        sliderHelper: function(array) {
          var min = d3.min(array);
          var max = d3.max(array);
          var tempArray = array.map(function(val){
            return ((val - min) / ((max - min) / 100)).toFixed(0) + '%';
          });
          tempArray.sort(function(a, b) {
            return a - b;
          });
          tempArray[0] = 'min';
          tempArray[tempArray.length - 1] = 'max';
          return tempArray;
        }
    });

})();
