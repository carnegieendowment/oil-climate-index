/*global Oci, Backbone, JST, L, d3, utils, ZeroClipboard*/

Oci.Views = Oci.Views || {};

(function () {
    'use strict';

    var self;
    var margin = {top: 0, right: 10, bottom: 0, left: 0};
    var container;
    var width;
    var height = 60 - margin.top - margin.bottom;
    var barBuffer = 2;
    var defaultModelHeight;
    var modelHeight;
    var defaultColor = '#ccc';
    var xScale;
    var upstreamSvg;
    var midstreamSvg;
    var downstreamSvg;
    var dataset;
    var chartData;
    var oilKey;

    Oci.Views.OilDetails = Backbone.View.extend({

        template: JST['app/scripts/templates/oildetails.ejs'],

        el: '.content',

        events: {
          'change #toggle-petcoke': 'handleParametersChange',
          'change .slider': 'handleParametersChange',
          'change .config-dropdown': 'handleDropdown',
          'click #oil-details-share': 'handleShare'
        },

        initialize: function (options) {
          self = this;

          // Find the oil key from the id
          for (var key in Oci.data.info) {
            if (utils.makeId(key) === options.oil) {
              oilKey = key;
              break;
            }
          }
          if (!oilKey) {
            console.warn('Unable to find key for oil id');
          }

          self.tip = d3.tip()
            .attr('class', 'd3-tip')
            .html(function(d, svg) {
              var unitsString = utils.getUnits('ghgTotal', 'perBarrel');
              var valuesString = '';
              var values = d.components[self.getStepName(svg)];
              for (var i = 0; i < values.length; i++) {
                valuesString += '<dt style="width:80%;">' + values[i].name + '</dt>';
                var value = Number(values[i].value);
                value = Math.abs(value) < 1 ? value.toFixed(1) : value.toFixed(0);
                valuesString += '<dd style="width:20%;">' + value + '</dd>';
              }
              return '<div class="popover in">' +
                '<div class="popover-inner">' +
                  '<div class="popover-header">' +
                    '<dl class="stats-list">' +
                      '<dt>' + self.getStepName(svg) + ' emissions<small class="units">' + unitsString + '</small></dt><dd>' + self.dataForSvg(svg, d).toFixed(0) + '</dd>' +
                    '</dl>' +
                  '</div>' +
                  '<div class="popover-body">' +
                    '<dl class="stats-list">' +
                    valuesString +
                    '</dl>' +
                  '</div>' +
                '</div>' +
              '</div>';
            })
            // set tooltip offset and direction differently if they are "too small"
            .offset(function(d, svg){
              if (self.dataForSvg(svg, d) < xScale.domain()[1] * 0.3){
                return [0,25];
              }
              else {
                return [-10,0];
              }
            })
            .direction(function(d, svg){
              if (self.dataForSvg(svg, d) < xScale.domain()[1] * 0.3){
                return 'e';
              }
              else {
                return 'n';
              }
            });

          // Generate the oil info section
          self.oil = self.generateOilInfo();

          this.render();

          $(window).on('resize', function(){
            if (window.orientation === undefined) { self.handleResize(); }
          });
          $(window).on('orientationchange', function(){
            setTimeout(function(){
              self.handleResize();
            },500);
          });
        },

        render: function () {
          this.$el.html(this.template({oil: this.oil, totalUnits: utils.getUnits('ghgTotal', 'perBarrel')}));
          this.$('[data-toggle="tooltip"]').tooltip();

          this.modelParametersView = new Oci.Views.ModelParameters();
          this.$('#model-parameters').html(this.modelParametersView.render());
          // special handling of refinery dropdown for oil details view
          $('#dropdown-refinery').prop('selectedIndex', utils.refineryNameToDropdown(Oci.data.info[oilKey]['Default Refinery']));
          $('#dropdown-refinery option[value="0 = Default"]').hide()

          // Determine bar heights
          defaultModelHeight = height * (1/3) - barBuffer;
          modelHeight = height - defaultModelHeight;

          // Set oil description
          $('#oil-details-description').html(Oci.blurbs[oilKey].description);

          L.mapbox.accessToken = 'pk.eyJ1IjoiZGV2c2VlZCIsImEiOiJnUi1mbkVvIn0.018aLhX0Mb0tdtaT2QNe2Q';

          var map = L.mapbox.map('map', 'mapbox.light', {
            center: [20, 0],
            zoom: 3,
            zoomControl: false,
            keyboard: false,
            tap: false,
            dragging: false,
            touchZoom: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false
          });

          // add marker for each oil field, make one active
          _.each(Oci.data.info, function(oil){
            var icon = L.divIcon({
              html: '<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" width="24" height="24" id="svg4460"> <defs id="defs4462" /> <metadata id="metadata4465"> <rdf:RDF> <cc:Work rdf:about=""> <dc:format>image/svg+xml</dc:format> <dc:type rdf:resource="http://purl.org/dc/dcmitype/StillImage" /> <dc:title /> </cc:Work> </rdf:RDF> </metadata> <g transform="translate(0,-1028.3622)" id="layer1"> <g transform="translate(-476,-237.99998)" id="oil-well-24" style="display:inline"> <g transform="translate(2,0)" id="g7345"> <path d="m 484.5,1269.3622 c -0.5,0 -0.84615,0.5 -1,1 l -5.34375,15.9688 c -0.038,0.1133 -0.15625,0.4166 -0.15625,0.5312 0,0.5 0.5,0.5 1,0.5 0.5,0 0.97049,0 1.15625,-0.5 l 0.84375,-2.25 5.5,-2.75 5.5,2.75 0.84375,2.25 c 0.18576,0.5 0.65625,0.5 1.15625,0.5 0.5,0 1,0 1,-0.5 0,-0.1146 -0.11823,-0.418 -0.15625,-0.5312 L 489.5,1270.3622 c -0.15385,-0.5 -0.5,-1 -1,-1 z m 4.5,7 0.6875,1.9063 -3.1875,1.5937 -3.1875,-1.5937 0.6875,-1.9063 z m -6.3125,3.5938 1.8125,0.9062 -2.625,1.3125 z m 7.625,0 0.8125,2.2187 -2.625,-1.3125 z" inkscape:connector-curvature="0" id="path5656" style="opacity:0.3;color:#000000;fill:#ffffff;fill-opacity:1;fill-rule:nonzero;stroke:#ffffff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none;stroke-dashoffset:0;marker:none;visibility:visible;display:inline;overflow:visible;enable-background:accumulate" /> <path d="m 484.5,1269.3622 c -0.5,0 -0.84615,0.5 -1,1 l -5.34375,15.9688 c -0.038,0.1133 -0.15625,0.4166 -0.15625,0.5312 0,0.5 0.5,0.5 1,0.5 0.5,0 0.97049,0 1.15625,-0.5 l 0.84375,-2.25 5.5,-2.75 5.5,2.75 0.84375,2.25 c 0.18576,0.5 0.65625,0.5 1.15625,0.5 0.5,0 1,0 1,-0.5 0,-0.1146 -0.11823,-0.418 -0.15625,-0.5312 L 489.5,1270.3622 c -0.15385,-0.5 -0.5,-1 -1,-1 z m 4.5,7 0.6875,1.9063 -3.1875,1.5937 -3.1875,-1.5937 0.6875,-1.9063 z m -6.3125,3.5938 1.8125,0.9062 -2.625,1.3125 z m 7.625,0 0.8125,2.2187 -2.625,-1.3125 z" inkscape:connector-curvature="0" id="path6960-9" style="color:#000000;fill:#444444;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:2;marker:none;visibility:visible;display:inline;overflow:visible;enable-background:accumulate" /> </g> </g> </g> <rect width="24" height="24" x="0" y="0" id="canvas" style="fill:none;stroke:none;visibility:hidden" /> </svg>',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
              className: (oilKey === oil.Unique) ? 'active' : 'non-active'
            });
            L.marker([oil.Latitude, oil.Longitude], {icon: icon, clickable: false}).addTo(map);
          });

          // zoom to active
          var zoomOil = Oci.data.info[oilKey];
          map.setView([zoomOil.Latitude, zoomOil.Longitude], 4);

          this.parseURLAndSetState();
          this.chartInit();
          this.linkShareButton();
          utils.initDropdown();
        },

        getStepName: function (svg) {
          return svg[0][0].parentNode.parentNode.id.split('-')[0];
        },

        generateOilInfo: function () {
          // Get the oil info
          var oil = Oci.data.info[oilKey];

          if (!oil) {
            // If we're here, something went wrong
            console.warn('Unable to find oil for id:', oilKey);
          }

          var makeCategoryTitle = function (api, sulfur) {
            return 'API Gravity: ' + parseInt(api) + ' | Sulfur Percentage: ' + parseFloat(sulfur).toFixed(2) + '%';
          };

          var makeDepthTitle = function (depth) {
            return parseInt(depth) + ' feet | ' + parseInt(depth * 0.3048) + ' meters';
          };

          // Create return object
          var obj = {
            name: utils.prettyOilName(oil),
            keyStats: [
              {
                key: 'Oil-Climate Category',
                value: oil['Overall Crude Emissions Category']
              },
              {
                key: 'Location',
                value: oil['Onshore/Offshore']
              },
              {
                key: 'Sulfur Content',
                value: oil['Sulfur Category'],
                title: makeCategoryTitle(oil.API, oil['Sulfur %wt'])
              },
              {
                key: 'Depth',
                value: oil['Shallow; Deep; Ultra-Deep'],
                title: makeDepthTitle(oil['Field Depth'])
              },
              {
                key: 'Production Volume',
                value: oil['Production Volume']
              },
              {
                key: 'Flare Rate',
                value: oil['Flaring Class']
              },{
                key: 'Water Content',
                value: oil['Watery Oil']
              },{
                key: 'Gas Content',
                value: oil['Gassy Oil']
              },{
                key: 'Default Refinery Configuration',
                value: oil['Default Refinery']
              },
            ],
          };
          return obj;
        },

        parseURLAndSetState: function () {
          // Handle any parameters we're interested in catching here
          var params = utils.parseParametersFromShareURL(window.location.href);

          // Handle url update - http://stackoverflow.com/questions/17550059/backbone-js-change-url-without-reloading-the-page
          window.history.pushState('', '', window.location.hash.split('?')[0]);

          // Set model parameters
          if (params.opgee || params.prelim || params.showCoke) {
            self.modelParametersView.setModelParameters(params);
          }
        },

        linkShareButton: function () {
          var shareClient = new ZeroClipboard($('#oil-details-share'));
          shareClient.on('ready', function () {
            shareClient.on('copy', function (event) {
              var clipboard = event.clipboardData;
              var params = self.modelParametersView.getModelValues();
              var url = utils.buildShareURLFromParameters({
                opgee: utils.getOPGEEModel(params.water, params.steam, params.flaring),
                prelim: utils.getPRELIMModel(params.refinery),
                showCoke: params.showCoke
              });
              clipboard.setData('text/plain', url);
            });

            shareClient.on('aftercopy', function () {
              alert('The shareable URL has been copied to your clipboard.');
            });
          });
        },

        updateSvg: function (svg) {
          svg.selectAll('rect')
             .data(chartData)
             .transition()
             .duration(1000)
             .attr('width', function(d) {
                return xScale(self.dataForSvg(svg, d));
             });

          // Create small bars to indicate components
          var x0 = 0;
          var components = chartData[1].components[self.getStepName(svg)];
          svg.selectAll('.component')
             .data(components)
             .transition()
             .duration(1000)
             .attr('x', function(d) {
                x0 += +d.value;
                return xScale(x0);
             });
        },

        createChartData: function () {
          // Generates an oil object for plotting, potentially using default values
          var generateOilObject = function (modelData, showCoke, isDefault) {
            // Get basic properties from model data
            var info = modelData.info[oilKey];
            var opgee = modelData.opgee[oilKey];
            var prelim = modelData.prelim[oilKey];
            var upstream = +opgee['Net lifecycle emissions'];
            var midstream = +utils.getRefiningTotal(prelim);
            var transport = +info[utils.getDatasetKey('transport')];
            var combustion = +utils.getCombustionTotal(prelim, showCoke);

            // Sum up for total
            var ghgTotal = d3.sum([upstream, midstream, transport, combustion]);

            // Create oil object
            var obj = {
              'isDefault': isDefault,
              'id': utils.makeId(info.Unique),
              'name': utils.prettyOilName(info),
              'apiGravity': +info[utils.getDatasetKey('apiGravity')],
              'oilDepth': +info[utils.getDatasetKey('oilDepth')],
              'ghgTotal': ghgTotal,
              'upstream': upstream,
              'midstream': midstream,
              'downstream': combustion + transport,
              'waterToOilRatio': +opgee[utils.getDatasetKey('waterToOilRatio')],
              'gasToOilRatio': +opgee[utils.getDatasetKey('gasToOilRatio')],
              'type': info['Overall Crude Emissions Category'].trim(),
              'components': {
                'downstream': utils.getDownstreamComponents(prelim, showCoke, transport),
                'midstream': utils.getRefiningComponents(prelim),
                'upstream': utils.getExtractionComponents(opgee)
              }
            };

            return obj;
          };

          // Default model data
          var defaultModelData = {
            info: dataset.info,
            opgee: dataset.opgee[utils.getOPGEEModel('1', '1', '1')],
            prelim: dataset.prelim[utils.getPRELIMModel('0 = Default')]
          };

          // Grab things based on the model we're using
          var params = this.modelParametersView.getModelValues();
          var modelData = {
            info: dataset.info,
            opgee: dataset.opgee[utils.getOPGEEModel(params.water, params.steam, params.flaring)],
            prelim: dataset.prelim[utils.getPRELIMModel(params.refinery)]
          };

          chartData = [generateOilObject(defaultModelData, true, true),
                        generateOilObject(modelData, params.showCoke, false)];
        },

        dataForSvg: function (svg, data) {
          if (svg === upstreamSvg) {
            return data.upstream;
          } else if (svg === downstreamSvg) {
            return data.downstream;
          } else if (svg === midstreamSvg) {
            return data.midstream;
          } else {
            console.warn('oops!');
          }
        },

        handleParametersChange: function () {
          self.createChartData();
          $('#model-total').html(chartData[1].ghgTotal.toFixed(0));
          self.updateSvg(upstreamSvg);
          self.updateSvg(downstreamSvg);
          self.updateSvg(midstreamSvg);
        },

        chartInit: function () {
          var createScales = function() {

            xScale = d3.scale.linear()
                            .domain([0, d3.max(chartData,
                              function (d) {
                                return d3.max([utils.getGlobalExtent('perBarrel', 'max', 'downstream', oilKey),
                                               utils.getGlobalExtent('perBarrel', 'max', 'midstream', oilKey),
                                               utils.getGlobalExtent('perBarrel', 'max', 'upstream', oilKey)]);
                              })])
                            .range([0, width]);

          };

          var createData = function(svg) {
            // Set label
            $('#model-total').html(chartData[1].ghgTotal.toFixed(0));
            $('#default-total').html('(' + chartData[0].ghgTotal.toFixed(0) + ')');
            $('#od-chart-cont .data-charts .value').css('color', utils.categoryColorForType(chartData[1].type));
            $('#oil-name').html(self.oil.name);
            //Create bars
            svg.selectAll('rect')
               .data(chartData)
               .enter()
               .append('rect')
               .attr('x', function() {
                  return xScale(0);
               })
               .attr('y', function(d) {
                  if (d.isDefault) {
                    return modelHeight + barBuffer;
                  } else {
                    return 0;
                  }
               })
               .attr('width', function(d) {
                  return xScale(self.dataForSvg(svg, d));
               })
               .attr('height', function(d) {
                  if (d.isDefault) {
                    return defaultModelHeight;
                  } else {
                    return modelHeight;
                  }
               })
               .attr('rx', 2)
               .attr('ry', 2)
               .attr('fill', function(d) {
                if (d.isDefault) {
                  return defaultColor;
                } else {
                  return utils.categoryColorForType(d.type);
                }
               })
               .attr('opacity', function(d) {
                if (d.isDefault) {
                  return 0.6;
                } else {
                  return 0.8;
                }
               })
               .on('mouseover', function(d) {
                if (!d.isDefault) {
                  self.tip.show(d, svg);
                }
               })
               .on('mouseout', function(d) {
                if (!d.isDefault) {
                  if (utils.insideTooltip(d3.event.clientX, d3.event.clientY)) {
                   $('.d3-tip').on('mouseleave', function() {
                     self.tip.hide();
                   });
                  }
                  else {
                    self.tip.hide();
                  }
                }
               });

            // Create small bars to indicate components if everything is positive
            var x0 = 0;
            var components = chartData[1].components[self.getStepName(svg)];
            var allPositive = _.every(components,
              function (component) {
                return +component.value >= 0;
              });
            if (allPositive) {
              svg.selectAll('.component')
                 .data(components)
                 .enter()
                 .append('rect')
                 .attr('class', 'component')
                 .attr('pointer-events', 'none')
                 .attr('x', function(d) {
                    x0 += +d.value;
                    return xScale(x0);
                 })
                 .attr('y', 0)
                 .attr('width', xScale(0.25))
                 .attr('height', modelHeight)
                 .attr('rx', 2)
                 .attr('ry', 2)
                 .attr('fill', '#fff');
            }
          };

          // For responsiveness
          container = $('.panel-body');
          width = container.width() - margin.left - margin.right;

          //Create SVG element
          upstreamSvg = d3.select('#upstream-bar')
                      .append('svg')
                      .attr('width', width + margin.left + margin.right)
                      .attr('height', height + margin.top + margin.bottom)
                    .append('g')
                      .attr('transform',
                            'translate(' + margin.left + ',' + margin.top + ')');

          downstreamSvg = d3.select('#downstream-bar')
                      .append('svg')
                      .attr('width', width + margin.left + margin.right)
                      .attr('height', height + margin.top + margin.bottom)
                    .append('g')
                      .attr('transform',
                            'translate(' + margin.left + ',' + margin.top + ')');

          midstreamSvg = d3.select('#midstream-bar')
                      .append('svg')
                      .attr('width', width + margin.left + margin.right)
                      .attr('height', height + margin.top + margin.bottom)
                    .append('g')
                      .attr('transform',
                            'translate(' + margin.left + ',' + margin.top + ')');

          // Invoke the tooltip
          upstreamSvg.call(self.tip);
          midstreamSvg.call(self.tip);
          downstreamSvg.call(self.tip);


          // Keep this around to grab values from for display if needed
          dataset = utils.cloneObject(Oci.data);

          self.createChartData();
          createScales();
          createData(upstreamSvg);
          createData(midstreamSvg);
          createData(downstreamSvg);
        },

        handleDropdown: function () {
          $('.config-dropdown').blur();
          self.handleParametersChange();
        },


        handleResize: function () {
          width = container.width() - margin.left - margin.right;
          // Clear anything in the svg element since we're going to rewrite
          d3.select('#upstream-bar').html('');
          d3.select('#midstream-bar').html('');
          d3.select('#downstream-bar').html('');
          self.chartInit();
        },

        handleShare: function (e) {
          e.preventDefault();
        },

        shareOpen: function () {
          var params = self.modelParametersView.getModelValues();
          var url = utils.buildShareURLFromParameters({
            opgee: utils.getOPGEEModel(params.water, params.steam, params.flaring),
            prelim: utils.getPRELIMModel(params.refinery),
            showCoke: params.showCoke
          });

          var pageURL = encodeURIComponent(utils.buildShareURLFromParameters({}));
          var links = utils.generateSocialLinks(pageURL);

          // Twitter share
          $('li.twitter a').attr('href', links.twitter);

          // Facebook handled by meta tags

          // LinkedIn
          $('li.linkedin a').attr('href', links.linkedIn);

          // Mail
          $('li.email a').attr('href', links.mail);

          // Readonly input field
          $('#share-copy').attr('value', url);
        }

    });

})();
