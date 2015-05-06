/*global d3*/
var utils;

(function() {
  'use strict';

  utils = {
    // Get global extents for dataset
    // send ratio, min/max
    // optional component and oil
    // store them and return so we only have to calculate once per session
    getGlobalExtent: function (ratio, minMax, component, selectedOil) {

      // handle this one input differently
      if (component === 'ghgTotal') {
        component = null;
      }

      // check if this already exists and return if so
      var oilLookup = (selectedOil) ? selectedOil : 'global';
      var componentLookup = (component) ? component : 'total';
      if (Oci.data.globalExtents[ratio] &&
          Oci.data.globalExtents[ratio][oilLookup] &&
          Oci.data.globalExtents[ratio][oilLookup][componentLookup] &&
          Oci.data.globalExtents[ratio][oilLookup][componentLookup][minMax]) {
        return Oci.data.globalExtents[ratio][oilLookup][componentLookup][minMax];
      }

      var data = Oci.data;

      // filter data if only one oil is selected
      var oils = data.info;
      if (selectedOil) {
        oils = _.object([selectedOil], _.filter(oils, function(obj, key) { return key === selectedOil; }));
      }

      // figure out whether to calculate mins or maxs
      var minMaxMultiplier = (minMax === 'min') ? -1 : 1;
      var extent = null;

      // make a components object for easier summing later
      var components = {};

      // Loop
      for (var key in oils) {
        var opgeeExtent = null;
        var transport = +oils[key]['Transport Emissions'];  // Transport total
        for (var i = 0; i < data.metadata.water.split(',').length; i++) {
          for (var j = 0; j < data.metadata.steam.split(',').length; j++) {
            for (var k = 0; k < data.metadata.flare.split(',').length; k++) {
              var opgee = data.opgee['run' + i + j + k][key];
              var extraction = +opgee['Net lifecycle emissions'];

              if (!opgeeExtent || (extraction * minMaxMultiplier > opgeeExtent * minMaxMultiplier)) {
                opgeeExtent = extraction;
              }
            }
          }
        }
        for (var l = 0; l < data.metadata.refinery.split(',').length; l++) {
          [true, false].forEach(function(showCoke) {

            var prelim = data.prelim['run' + l][key];

            var refining = +utils.getRefiningTotal(prelim);
            var combustion = +utils.getCombustionTotal(prelim, showCoke);

            // Sum it up! (conditionally based on whether component is selected)
            var total;
            components.upstream = opgeeExtent;
            components.midstream = refining;
            components.downstream = combustion + transport;
            if (component) {
              total = components[component];
            }
            else {
              total = _.reduce(components, function(a, b){ return a + b; }, 0);
            }

            // Handle ratio
            total = utils.getValueForRatio(total, ratio, prelim);

            // Check which is bigger (or smaller)
            if (!opgeeExtent || (extraction * minMaxMultiplier > opgeeExtent * minMaxMultiplier)) {
              opgeeExtent = extraction;
            }
            if (!extent || (total * minMaxMultiplier > extent * minMaxMultiplier)) {
              extent = total;
            }
          });
        }
      }

      // store for later (unless it's perDollar)
      if (ratio !== 'perDollar') {
        if (!Oci.data.globalExtents[ratio]){
          Oci.data.globalExtents[ratio] = {};
        }
        if (!Oci.data.globalExtents[ratio][oilLookup]) {
          Oci.data.globalExtents[ratio][oilLookup] = {};
        }
        if (!Oci.data.globalExtents[ratio][oilLookup][componentLookup]) {
          Oci.data.globalExtents[ratio][oilLookup][componentLookup] = {};
        }
        Oci.data.globalExtents[ratio][oilLookup][componentLookup][minMax] = extent;
      }
      return extent;
    },

    // Generate social sharing links
    generateSocialLinks: function(pageURL) {
      var summary = 'Explore the true cost of technological advancements across the complete oil supply chain.';
      var title = 'The Oil-Climate Index';

      // Twitter
      var twitter = 'https://twitter.com/share?' +
        'text=' + summary + '&' +
        'url=' + pageURL;

      // LinkedIn
      var linkedIn = 'http://www.linkedin.com/shareArticle?mini=true&' +
      'summary=' + summary + '&' +
      'title=' + title + '&' +
      'url=' + pageURL;

      // Mail
      var mail = 'mailto:?subject=' + title + '&' +
      'body=' + summary + '\n\n' + pageURL;

      return {
        twitter: twitter,
        linkedIn: linkedIn,
        mail: mail
      };
    },

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
    getValueForRatio: function (originalValue, ratio, prelim, showCoke) {
      switch(ratio) {
        case 'perBarrel':
          return originalValue;
        case 'perMJ':
          // GHG / barrel * barrel / MJ
          return originalValue * (1 / prelim.MJperbbl);
        case 'perDollar':
          // GHG / barrel * barrel / $
          return originalValue * (1.0 / this.getPricePerBarrel(prelim, showCoke));
        default:
          return originalValue;
      }
    },

    // Use prelim data and pricing info to determing blended price per barrel
    getPricePerBarrel: function (prelim, showCoke) {
      // Sum up price * portion in barrel
      var sum = prelim['Portion Gasoline'] * Oci.prices.gasoline.price +
        prelim['Portion Jet Fuel'] * Oci.prices.jetFuel.price +
        prelim['Portion Diesel'] * Oci.prices.diesel.price +
        prelim['Portion Fuel Oil'] * Oci.prices.fuelOil.price +
        prelim['Portion Bunker Fuel'] * Oci.prices.bunkerFuel.price;

      // Special conversion to get to per barrel
      sum = sum * 42 / 100000;

      // Add extra if we're including petcoke, formulas are provided by Carnegie
      if (showCoke) {
       sum += (((prelim['Portion Petroleum Coke'] / 5) * Oci.prices.coke.price) / 100000);
       sum += prelim['Net Upstream Petcoke'] * Oci.prices.coke.price;
      }

      return sum;
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
        case 'Conventional':
          return colors(1);
        case 'Extra-Heavy':
          return colors(2);
        case 'Heavy':
          return colors(3);
        case 'High Flare':
          return colors(4);
        case 'High Steam':
          return colors(5);
        case 'High Gas':
          return colors(6);
        case 'Light':
          return colors(7);
        case 'Depleted/Watery Oil':
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
    // If it's greater than one, round to int
    // sortRatio is a secondary optional parameter to allow custom handling
    numberWithCommas: function (x, sortRatio) {
      if (sortRatio === 'perMJ') return x.toFixed(2);
      x = x > 1 ? x.toFixed(0) : x.toFixed(1);
      return x.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
        case 'sulfurContent':
          return 'Sulfur %wt';
        case 'prodBunker':
          return 'Portion Bunker Fuel';
        case 'prodGasoline':
          return 'Portion Gasoline';
        case 'prodDiesel':
          return 'Portion Diesel';
        case 'yearsProduction':
          return 'Field Age';
        default:
          return console.warn('Unknown key');
      }
    },

    // Get units for name
    getUnits: function(key, sortRatio) {
      var getGHGUnits = function (sortRatio) {
        switch(sortRatio) {
          case 'perBarrel':
            return 'kg CO\u2082 eq./barrel crude';
          case 'perMJ':
            return 'kg CO\u2082 eq./MJ products';
          case 'perDollar':
            return 'kg CO\u2082 eq./$ products';
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
          return 'bbl water/bbl crude';
        case 'gasToOilRatio':
          return 'scf/bbl crude';
        case 'productionVolume':
          return 'barrels per day';
        case 'emissionRate':
          return 'kg CO<sub>2</sub> eq./day';
        case 'yearsProduction':
          return 'Years';
        case 'sulfurContent':
          return '% weight';
        case 'prodGasoline':
        case 'prodDiesel':
        case 'prodBunker':
          return 'bbl product/100,000 bbl crude';
        case 'type':
        case 'ghgTotal':
        case 'upstream':
        case 'midstream':
        case 'downstream':
          return getGHGUnits(sortRatio);
      }
    },

    // Get a nice name for a key, with a special case for Emissions Drivers
    getDatasetName: function (key, sortRatio, isDrivers) {
      var addRatioString = function (title, sortRatio) {
        if (!sortRatio) {
          return title;
        }

        switch(sortRatio) {
          case 'perBarrel':
            return title += '';
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
          return 'Current Estimated Oil Production';
        case 'prodGasoline':
          return 'Gasoline Production';
        case 'prodDiesel':
          return 'Diesel Production';
        case 'prodBunker':
          return 'Bunker Fuel Production';
        case 'yearsProduction':
          return 'Years in Production';
        case 'sulfurContent':
          return 'Sulfur Content';
        case 'type':
        case 'ghgTotal':
        case 'midstream':
        case 'upstream':
        case 'downstream':
          if (isDrivers === true && key !== 'ghgTotal') {
            return addRatioString(key + ' Greenhouse Gas Emissions', sortRatio);
          } else {
            return addRatioString('Total Greenhouse Gas Emissions', sortRatio);
          }
          break;
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

      var combustionArray = [prelim['Gasoline'], prelim['Jet Fuel'],
        prelim['Diesel'], prelim['Fuel Oil'], prelim['Bunker Fuel'],
        prelim['Light Ends (RFG)']];

      if (showCoke) {
        combustionArray.push(prelim['Petroleum Coke']);
        combustionArray.push(prelim['Net Upstream Petcoke']);
      }

      return d3.sum(combustionArray);
    },

    // Return combustion components
    getDownstreamComponents: function (prelim, showCoke, transport) {
      var outList = ['Heat','Steam','Electricity','Hydrogen','Fluid','Excess','Portion','Total','Unique','MJperbbl'];

      var objArray = _.filter(_.map(prelim, function(el, key){
        return { name: key, value: el };
      }), function(el) {
        return !_.contains(['Petroleum Coke','Net Upstream Petcoke'],el.name);
      });

      // add a combined petcoke object
      if (showCoke === true) {
        objArray.push({
          name: 'Petroleum Coke',
          value: (Number(prelim['Petroleum Coke']) || 0) + (Number(prelim['Net Upstream Petcoke']) || 0)
        });
      }
      // Add transport since we're combining it and combustion for downstream
      objArray.push({ name: 'Transport to Consumers', value: transport });
      var unsorted =  _.filter(objArray, function(el) {
        return (!(_.contains(outList,el.name.split(' ')[0])) && Number(el.value) > 0.005);
      });
      return this.preorderedSort(unsorted, 'downstream');
    },

    // Return refining components
    getRefiningComponents: function (prelim) {
      var refining = [{
        name: 'Heat',
        value: this.aggregatePrelim(prelim, 'Heat')
      },
      {
        name: 'Electricity',
        value: +prelim['Electricity']
      },
      {
        name: 'Steam',
        value: this.aggregatePrelim(prelim, 'Steam')
      },
      {
        name: 'Hydrogen (via Steam Methane Reformer)',
        value: this.aggregatePrelim(prelim, 'Hydrogen')
      },
      {
        name: 'Catalyst Regeneration (Fluid Catalytic Cracking)',
        value: +prelim['Fluid Catalytic Cracking Regeneration']
      }];
      return _.filter(refining, function(el){
        return el.value > 0.005;
      });
    },

    // Return extraction components
    getExtractionComponents: function (opgee) {
      var outList = ['Water-to-Oil-Ratio','Net','API','Gas-to-Oil-Ratio','Unique'];
      var objArray = _.map(opgee, function(el, key) {
        return {
          name: key,
          value: el
        }
      })
      var unsorted = _.filter(objArray, function(el){
        return (!(_.contains(outList,el.name.split(' ')[0])) && Number(el.value).toFixed(0) !== '0')
      });
      return this.preorderedSort(unsorted, 'upstream');
    },

    // Aggregates prelim components according to a string
    // String matches against first word of prelim properties
    aggregatePrelim: function(prelim, string) {
      return _.reduce(prelim, function(a,b,key){
        return a + ((key.split(' ')[0] === string) ? Number(b) : 0)
      },0)
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
    // of values like [{name: foo, value: 12, units: bbl}, {name: bar, value: 123, units: bbl}],
    // an oil name, and a link
    createTooltipHtml: function (title, type, values, link, text) {
      var valuesString = '';
      for (var i = 0; i < values.length; i++) {
        var v = values[i];
        valuesString += '<dt>' + v.name + '<small class="units">' + v.units + '</small></dt>';
        valuesString += '<dd>' + v.value + '</dd>';
      }
      var html = '<div class="popover top in">' +
        '<div class="popover-inner">' +
          '<div class="popover-header">' +
            '<p class="popover-meta oil-type"><a href="methodology.html#oiltype-legend"><span class="swatch"></span>' + type + '</a></p>' +
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

    },

    preorderedSort: function (array, step) {
      return _.sortBy(array, function(sort){
        return Oci.order[step].indexOf(sort.name);
      })
    },

    refineryNameToDropdown: function (refinery) {
      var dropdown;
      switch(refinery) {
        case 'Hydroskimming Configuration':
          dropdown = 1;
          break;
        case 'Medium Conversion: FCC & GO-HC ':
          dropdown = 2;
          break;
        case 'Deep Conversion: FCC & GO-HC':
          dropdown = 3;
          break;
      }
      return dropdown;
    }
  };
})();
