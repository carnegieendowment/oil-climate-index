/*global d3*/
var utils;

(function() {
  'use strict';

  utils = {
    // Make a pretty oil name
    prettyOilName: function (oil) {
      return oil.Unique;
    },

    // Clone an object
    cloneObject: function (obj) {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }

      var temp = obj.constructor(); // give temp the original obj's constructor
      for (var key in obj) {
        temp[key] = this.cloneObject(obj[key]);
      }

      return temp;
    },

    // Convert the original value to a new value based on desired ratio type
    getValueForRatio: function (originalValue, ratio, prelim) {
      switch(ratio) {
        case 'perBarrel':
          return originalValue;
        case 'perMJ':
          // GHG / barrel * barrel / MJ
          return originalValue * (1 / prelim.MJperbbl);
        case 'perDollar':
          // GHG / barrel * barrel / $
          return originalValue * (1 / this.getPricePerBarrel(prelim));
        default:
          return originalValue;
      }
    },

    // Use prelim data and pricing info to determing blended price per barrel
    getPricePerBarrel: function (prelim) {
      var numerator = prelim['Portion Blended Gasoline'] * Oci.prices.gasoline.price +
        prelim['Portion Jet-A/AVTUR'] * Oci.prices.jetFuel.price +
        prelim['Portion ULSD'] * Oci.prices.diesel.price +
        prelim['Portion Fuel Oil'] * Oci.prices.fuelOil.price +
        prelim['Portion Coke'] * Oci.prices.coke.price +
        prelim['Portion Bunker C'] * Oci.prices.bunkerFuel.price;

      var denominator = d3.sum([prelim['Portion Blended Gasoline'],
        prelim['Portion Jet-A/AVTUR'], prelim['Portion ULSD'],
        prelim['Portion Fuel Oil'], prelim['Portion Coke'],
        prelim['Portion Bunker C']]);

      return numerator / denominator;
    },

    categoryColorForType: function (oilType) {

      var range = ['#003A63', '#009444', '#231F20', '#006838', '#645A4F',
                    '#006AA7', '#CCC7C2', '#8DC63F', '#0095DA'];
      var colors = d3.scale.ordinal()
                     .domain(d3.range(9))
                     .range(range);
      switch (oilType) {
        case 'Ultra-Deep':
          return colors(0);
        case 'Light':
          return colors(1);
        case 'Extra-Heavy':
          return colors(2);
        case 'High Flare':
          return colors(3);
        case 'Heavy':
          return colors(4);
        case 'High Steam':
          return colors(5);
        case 'High Gas':
          return colors(6);
        case 'Conventional':
          return colors(7);
        case 'Depleted Oil':
          return colors(8);
        default:
          console.warn('Invalid oil type for color', oilType);
          return '#ccc';
      }
    },

    // Build up a querystring from view parameters
    buildShareURLFromParameters: function (params) {
      if (!params || params === '') {
        return '';
      }

      var arr = [];
      for (var k in params) {
        arr.push(k + '=' + params[k]);
      }
      var qs;
      if (arr.length === 0) {
        qs = '';
      } else {
        qs = '?' + arr.join('&');
      }
      var hash = window.location.hash.split('?')[0];
      var path = window.location.pathname;
      var url = window.location.origin + path + hash + qs;

      return url;
    },

    // Build up a querystring from view parameters
    parseParametersFromShareURL: function (url) {
      if (!url || url === '') {
        return {};
      }

      var qs = url.split('?');
      if (qs.length !== 2) {
        return {};
      }

      var arr = qs[1].split('&');
      var params = {};
      for (var i = 0; i < arr.length; i++) {
        var item = arr[i].split('=');
        if (item.length !== 2) {
          return {};
        }
        params[item[0]] = item[1];
      }

      return params;
    },

    // Send an oil name, get a unique ID
    makeId: function (unique) {
      return unique.toLowerCase().replace(/ /g,'-');
    },

    // Return a string with first letter uppercased
    capitalize: function (s) {
      if (!s) {
        return '';
      }

      return s[0].toUpperCase() + s.slice(1);
    },

    // Add commas to a number string
    numberWithCommas: function (x) {
      return x.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    // Find and set option for a radio button input field
    setInputFieldOption: function (inputField, option) {
      var options = document.getElementsByName(inputField);
      for (var i = 0; i < options.length; i++) {
        if (options[i].value === option) {
          options[i].checked = true;
          break;
        }
      }
    },

    // Get dataset key for a given programmatic-friendly key
    getDatasetKey: function (key) {
      switch(key) {
        case 'apiGravity':
          return 'API';
        case 'oilDepth':
          return 'Field Depth';
        case 'waterToOilRatio':
          return 'Water-to-Oil-Ratio';
        case 'gasToOilRatio':
          return 'Gas-to-Oil-Ratio';
        case 'ghgTotal':
          return 'Total Emissions';
        case 'transport':
          return 'Transport Emissions';
        case 'productionVolume':
          return 'Oil Production Volume';
        default:
          return console.warn('Unknown key');
      }
    },

    // Get units for name
    getUnits: function(key, sortRatio) {
      var getGHGUnits = function (sortRatio) {
        switch(sortRatio) {
          case 'perBarrel':
            return 'kgCO2eq/bbl';
          case 'perMJ':
            return 'kgCO2eq/MJ';
          case 'perDollar':
            return 'kgCO2eq/$';
          default:
            console.warn('unknown sort ratio');
            return '';
        }
      };

      switch(key) {
        case 'apiGravity':
          return 'deg API';
        case 'oilDepth':
          return 'feet';
        case 'waterToOilRatio':
          return 'bbl water/bbl oil';
        case 'gasToOilRatio':
          return 'scf/bbl oil';
        case 'productionVolume':
          return 'bbl crude';
        case 'ghgTotal':
        case 'refining':
        case 'extraction':
        case 'transport':
        case 'combustion':
          return getGHGUnits(sortRatio);
      }
    },

    // Get a nice name for a key
    getDatasetName: function (key, sortRatio) {
      var addRatioString = function (title, sortRatio) {
        if (!sortRatio) {
          return title;
        }

        switch(sortRatio) {
          case 'perBarrel':
            return title += ' Per Barrel';
          case 'perMJ':
            return title += ' Per Megajoule';
          case 'perDollar':
            return title += ' Per Dollar';
          default:
            console.warn('Unknown sort ratio');
            return title;
        }
      };
      switch(key) {
        case 'apiGravity':
          return 'API Gravity';
        case 'oilDepth':
          return 'Field Depth';
        case 'waterToOilRatio':
          return 'Water-to-Oil Ratio';
        case 'gasToOilRatio':
          return 'Gas-to-Oil Ratio';
        case 'productionVolume':
          return 'Production Volume';
        case 'ghgTotal':
          return addRatioString('Total Greenhouse Gas Emissions', sortRatio);
        case 'refining':
          return addRatioString('Greenhouse Gas Emissions from Refining', sortRatio);
        case 'extraction':
          return addRatioString('Greenhouse Gas Emissions from Extraction', sortRatio);
        case 'transport':
          return addRatioString('Greenhouse Gas Emissions from Transport', sortRatio);
        case 'combustion':
          return addRatioString('Greenhouse Gas Emissions from Combustion', sortRatio);
        default:
          console.warn('Unknown key');
          return '';
      }
    },

    // Type insensitive indexOf
    indexInArray: function (array, value) {
      var index = -1;
      for (var i = 0; i < array.length; i++) {
        if (array[i] == value) {
          index = i;
          break;
        }
      }

      return index;
    },

    // Get the current OPGEE model based on model parameters
    getOPGEEModel: function (water, steam, flaring) {
      var metadata = Oci.data.metadata;
      var wi = this.indexInArray(this.trimMetadataArray(metadata.water.split(',')), water);
      var si = this.indexInArray(this.trimMetadataArray(metadata.steam.split(',')), steam);
      var fi = this.indexInArray(this.trimMetadataArray(metadata.flare.split(',')), flaring);

      // Generate model string
      var model = 'run';
      // If we don't have a match, return default
      if (wi === -1 || si === -1 || fi === -1) {
        model += '000';
      } else {
        model += [wi, si, fi].join('');
      }
      return model;
    },

    // Get the current PRELIM model
    getPRELIMModel: function (refinery) {
      var metadata = Oci.data.metadata;
      var ri = this.trimMetadataArray(metadata.refinery.split(',')).indexOf(refinery);

      // Generate model string
      var model = 'run';
      // If we don't have a match, return default
      if (ri === -1) {
        model += '0';
      } else {
        model += ri;
      }
      return model;
    },

    // Sum up combustion fields
    getCombustionTotal: function (prelim, showCoke) {
      var cokeArray = [prelim['Blended Gasoline'], prelim['Jet-A/AVTUR'],
        prelim['ULSD'], prelim['Fuel Oil'], prelim['Coke'], prelim['Bunker C'],
        prelim['Light Ends (RFG)'],
        prelim['Pet Coke (Upgrading) - Net Upstream Use)']];

      var noCokeArray = [prelim['Blended Gasoline'], prelim['Jet-A/AVTUR'],
        prelim['ULSD'], prelim['Fuel Oil'], prelim['Bunker C'],
        prelim['Light Ends (RFG)']];

      var sumArray = showCoke ? cokeArray : noCokeArray;
      return d3.sum(sumArray);
    },

    // Return combustion components
    getCombustionComponents: function (prelim, showCoke) {
      var outList = ['Heat','Steam','Electricty','Hydrogen','FCC','Excess','Portion','Total','Unique','MJperbbl'];
      if (showCoke === true){
        outList.push('Coke')
        outList.push('Pet')
      }
      var objArray = _.map(prelim, function(el, key){
        return {
          name: key,
          value: el
        }
      })
      return _.filter(objArray, function(el){
        return (!(_.contains(outList,el.name.split(' ')[0])) && Number(el.value) > 0.001)
      })
    },

    // Return refining components
    getRefiningComponents: function (prelim) {
      var inList = ['Heat','Steam','Electricty','Hydrogen','FCC','Excess'];
      var objArray = _.map(prelim, function(el, key){
        return {
          name: key,
          value: el
        }
      })
      return _.filter(objArray, function(el){
        return (_.contains(inList,el.name.split(' ')[0]) && Number(el.value) > 0.001)
      })
    },

    // Return extraction components
    getExtractionComponents: function (opgee) {
      var outList = ['Water-to-Oil-Ratio','Net','API','Gas-to-Oil-Ratio','Unique'];
      var objArray = _.map(opgee, function(el, key){
        return {
          name: key,
          value: el
        }
      })
      return _.filter(objArray, function(el){
        return (!(_.contains(outList,el.name.split(' ')[0])) && Number(el.value) > 0.001)
      })
    },

    // Sum up refining fields
    getRefiningTotal: function (prelim) {
      return prelim['Total refinery processes '];
    },

    // Trim metadata arrays
    trimMetadataArray: function (indices) {
      return indices.map(function(index) {
        return index.trim();
      });
    },

    // Create the tooltip html given a title, a type, an array
    // of values like [{key: foo, value: 12}, {key: bar, value: 123}],
    // an oil name, and a link
    createTooltipHtml: function (title, type, values, link, text) {
      var valuesString = '';
      for (var i = 0; i < values.length; i++) {
        valuesString += '<dt>' + values[i].name + '</dt>';
        valuesString += '<dd>' + values[i].value + '</dd>';
      }
      var html = '<div class="popover top in">' +
        '<div class="popover-inner">' +
          '<div class="popover-header">' +
            '<p class="popover-meta oil-type"><span class="swatch"></span>' + type + '</p>' +
            '<h3 class="popover-title">' + title + '</h3>' +
            (text ? '<p class="description">' + text + '</p>' : '') +
          '</div>' +
          '<div class="popover-body">' +
            '<dl class="stats-list">' +
            valuesString +
            '</dl>' +
          '</div>' +
          '<div class="popover-footer">' +
            '<p><a href="#oil/' + link + '" title="View oil profile" class="view-more">View details</a></p>' +
          '</div>' +
        '</div>' +
      '</div>';

      return html;
    },

    // send x and y coordinates
    // returns a boolean to determine if they are inside the tooltip
    // a bit of buffer on left and bottom for arrows and such
    insideTooltip: function (x, y) {
      var box = $('.d3-tip')[0].getBoundingClientRect();
      return (x > box.left - 30 && x < box.right && y < box.bottom + 30 && y > box.top)
    },

    initDropdown: function () {
      $('[data-toggle="dropdown"]:not(.dropdown-processed)').click(function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('dropdown-processed');

        var parent = $(this).parent('.dropdown');
        parent.toggleClass('open');

        Oci.view.shareOpen();

        $('.dropdown.open').not(parent).removeClass('open');
      });

    }
  };
})();
