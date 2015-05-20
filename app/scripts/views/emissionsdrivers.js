/*global Oci, Backbone, JST, d3, utils, ss, ZeroClipboard*/

Oci.Views = Oci.Views || {};

(function () {
    'use strict';

    var self;
    var chartElement = '#emissions-drivers';
    var margin = {top: 38, right: 18, bottom: 72, left: 84};
    var container;
    var width;
    var height;
    var aspectRatio = 1.5;
    var xScale;
    var yScale;
    var rScale;
    var xAxis;
    var yAxis;
    var dataset;
    var chartData;
    var svg;
    var line;
    var linearRegression;
    var transitionDuration = 1000;
    var extentBuffer = 0.1;
    var xProperty;
    var yProperty;
    var sortRatio;

    Oci.Views.EmissionsDrivers = Backbone.View.extend({

        template: JST['app/scripts/templates/emissionsdrivers.ejs'],

        el: '.content',

        events: {
          'click #x-select': 'changeXProperty',
          'click #y-select': 'changeYProperty',
          'click #ratio-select': 'handleRatioSelect',
          'click #emissions-drivers-share': 'handleShare',
          'click': 'hideTip',
          'click #price-button': 'showPrices',
          'change #toggle-petcoke': 'handleParametersChange',
          'change .slider': 'handleParametersChange',
          'change .config-dropdown': 'handleDropdown',
          'click .mp-summary': 'handleParametersToggle'
        },

        hideTip: function() {
          self.tip.hide();
        },

        initialize: function () {
          self = this;

          $(window).on('resize', function(){
            if (window.orientation === undefined) { self.handleResize(); }
          });
          $(window).on('orientationchange', function(){
            setTimeout(function(){
              self.handleResize();
            },500);
          });

          self.tip = d3.tip().attr('class', 'd3-tip').html(function(d) {
            var values = [{
              name: utils.getDatasetName(xProperty),
              value: utils.numberWithCommas(+d[xProperty]),
              units: utils.getUnits(xProperty, sortRatio)
            },
            {
              name: utils.getDatasetName(yProperty).split(' ').pop(),
              value: utils.numberWithCommas(+d[yProperty], sortRatio),
              units: utils.getUnits(yProperty, sortRatio)
            },
            {
              name: utils.getDatasetName('productionVolume'),
              value: utils.numberWithCommas(d.productionVolume),
              units: utils.getUnits('productionVolume', sortRatio)
            }];
            return utils.createTooltipHtml(d.name, d.type, values, d.id);
          }).offset([0,0]);

          xProperty = 'apiGravity';
          yProperty = 'ghgTotal';
          sortRatio = 'perBarrel';

          self.render();
        },

        parseURLAndSetState: function () {
          // Handle any parameters we're interested in catching here
          var params = utils.parseParametersFromShareURL(window.location.href);

          // Handle url update - http://stackoverflow.com/questions/17550059/backbone-js-change-url-without-reloading-the-page
          window.history.pushState('', '', window.location.hash.split('?')[0]);

          // Set xProperty
          if (params.xProperty) {
            xProperty = params.xProperty;
            utils.setInputFieldOption('x-select', xProperty);
          }

          // Set yProperty
          if (params.yProperty) {
            yProperty = params.yProperty;
            utils.setInputFieldOption('y-select', yProperty);
          }

          // Set sort ratio
          if (params.sortRatio) {
            sortRatio = params.sortRatio;
            utils.setInputFieldOption('ratio-select', sortRatio);
          }

          // Set model parameters
          if (params.opgee || params.prelim || params.showCoke) {
            self.modelParametersView.setModelParameters(params);
          }
        },

        linkShareButton: function () {
          var shareClient = new ZeroClipboard($('#emissions-drivers-share'));
          shareClient.on('ready', function () {
            shareClient.on('copy', function (event) {
              var clipboard = event.clipboardData;
              var params = self.modelParametersView.getModelValues();
              var url = utils.buildShareURLFromParameters({
                xProperty: xProperty,
                yProperty: yProperty,
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

        render: function () {
          this.$el.html(this.template());
          this.modelParametersView = new Oci.Views.ModelParameters();
          this.$('#model-parameters').html(this.modelParametersView.render());
          this.parseURLAndSetState();
          this.chartInit();
          this.linkShareButton();
          utils.initDropdown();
        },

        addExtentBuffer: function(extent) {
          // sometimes only receives a max number and then we shouldn't try to access array elements
          if (typeof extent === 'object') {
            extent[0] = extent[0] * (1 - extentBuffer);
            extent[1] = extent[1] * (1 + extentBuffer);
          }
          else {
            extent = extent * (1 + extentBuffer);
          }
          return extent;
        },

        chartInit: function () {
          var createScales = function () {
            //Create scale functions
            var xMax =
              self.addExtentBuffer(d3.max(chartData, function(d) { return d[xProperty]; }));
            xScale = d3.scale.linear()
                       .domain([0, xMax])
                       .range([0, width]);

            var yMin = utils.getGlobalExtent(sortRatio, 'min', yProperty);
            var yMax = utils.getGlobalExtent(sortRatio, 'max', yProperty);
            var yExtent = self.addExtentBuffer([yMin, yMax]);

            yScale = d3.scale.linear()
                       .domain(yExtent)
                       .range([height, 0]);

            var rExtent =
              self.addExtentBuffer(d3.extent(chartData, function(d) { return d.productionVolume; }));
            rScale = d3.scale.sqrt()
                          .domain(rExtent)
                          .range([4, 42]);

            self.rScale = rScale;
          };

          var createAxes = function () {
            //Define X axis
            xAxis = d3.svg.axis()
                      .scale(xScale)
                      .orient('bottom')
                      .ticks(5);

            //Define Y axis
            yAxis = d3.svg.axis()
                      .scale(yScale)
                      .orient('left')
                      .ticks(5);

            //Create X axis
            svg.append('g')
              .attr('class', 'x axis')
              .attr('transform', 'translate(0,' + (height + 4) + ')')
              .call(xAxis);

            // X axis title
            var g = svg.append('g');
            g.append('text')
              .attr('transform', 'translate(' + (width / 2) + ',' +
                (height + margin.bottom - 25) + ')')
              .style('text-anchor', 'middle')
              .attr('class', 'x axis title')
              .text(utils.getDatasetName(xProperty));
            g.append('text')
              .attr('transform', 'translate(' + (width / 2) + ',' +
                (height + margin.bottom - 5) + ')')
              .style('text-anchor', 'middle')
              .attr('class', 'x axis title subtitle')
              .text(utils.getUnits(xProperty));

            //Create Y axis
            svg.append('g')
              .attr('class', 'y axis')
              .attr('transform', 'translate('+ (-4) + ',0)')
              .call(yAxis);

            // Y axis title
            g = svg.append('g');
            g.append('text')
              .attr('transform', 'rotate(-90)')
              .attr('y', -margin.left)
              .attr('x', -(height / 2))
              .attr('dy', '1em')
              .style('text-anchor', 'middle')
              .attr('class', 'y axis title')
              .text(utils.getDatasetName(yProperty, sortRatio, true));
            g.append('text')
              .attr('transform', 'rotate(-90)')
              .attr('y', -margin.left + 20)
              .attr('x', -(height / 2))
              .attr('dy', '1em')
              .style('text-anchor', 'middle')
              .attr('class', 'y axis title subtitle')
              .text(utils.getUnits(yProperty, sortRatio));
          };


          var createData = function () {
            //Create circles
            svg.selectAll('circle')
               .data(chartData)
               .enter()
               .append('circle')
               .attr('fill', function(d) {
                  return utils.categoryColorForType(d.type);
               })
               .attr('opacity', 0.8)
               .attr('cx', function(d) {
                return xScale(d[xProperty]);
               })
               .attr('cy', function(d) {
                return yScale(d[yProperty]);
               })
               .attr('r', function(d) {
                return rScale(d.productionVolume);
               })
               .attr('clip-path', 'url(#chart-area)')
               .on('mouseover', function(d){
                 self.tip.show(d);
                 $('.swatch').css('background',utils.categoryColorForType(d.type));
               })
               .on('mouseout', function(){
                 if (utils.insideTooltip(d3.event.clientX, d3.event.clientY)) {
                  $('.d3-tip').on('mouseleave', function() {
                    self.tip.hide();
                  });
                 }
                 else {
                   self.tip.hide();
                 }
               });

            // The circle legend
            d3.select('svg').selectAll('.circle-legend')
               .data([50,68,81])
               .enter()
               .append('circle')
               .classed('circle-legend', true)
               .attr('fill-opacity', '0')
               .attr('stroke', '#777')
               .attr('cx', function(d) {
                return width + margin.left + margin.right - 40;
               })
               .attr('cy', function(d) { return d; })
               .attr('r', function(d, i) {
                return rScale([500000, 100000, 1000][i]);
               });

              d3.select('svg').selectAll('.circle-text')
                .data([{ text: '500k', y: 11}, { text: '100k', y: 48}, { text: '10k', y: 74}])
                .enter()
                .append('text')
                .classed('circle-text', true)
                .attr('x', function(d) {
                 return width + margin.left + margin.right - 40;
                })
                .attr('y', function(d) { return d.y; })
                .attr('text-anchor','middle')
                .style('fill','#777')
                .text(function(d){ return d.text; })

              d3.select('svg').append('text')
                .attr('x', function(d) {
                 return width + margin.left + margin.right - 90;
                })
                .attr('y', 30)
                .attr('text-anchor','end')
                .classed('circle-text', true)
                .style('fill','#777')
                .text('Production Volume')

              d3.select('svg').append('text')
                .attr('x', function(d) {
                 return width + margin.left + margin.right - 90;
                })
                .attr('y', 45)
                .attr('text-anchor','end')
                .classed('circle-text', true)
                .style('fill','#777')
                .text('Barrels per Day')
          };

          var createLine = function () {
            // map our data to the style needed for simple-statistics
            // also apply our scaling
            var mapped = chartData.map(function(obj){
              return [xScale(obj[xProperty]),yScale(obj[yProperty])];
            });

            linearRegression = ss.linear_regression()
                                 .data(mapped).line();

            var r_squared = ss.r_squared(mapped, linearRegression);

            line = d3.svg.line()
                   .x(function (d) { return d; })
                   .y(function (d) { return linearRegression(d); });

            svg.append('path')
               .attr('clip-path', 'url(#chart-area)')
               .attr('d', line(xScale.range()))
               .attr('class','trend')
               .attr('opacity', Math.min(r_squared + .2, 1));
          };

          // For responsiveness
          container = $(chartElement);
          width = container.width() - margin.left - margin.right;
          height = Math.round(width / aspectRatio);

          //Create SVG element
          svg = d3.select(chartElement)
                      .append('svg')
                      .attr('width', width + margin.left + margin.right)
                      .attr('height',height + margin.top + margin.bottom)
                    .append('g')
                      .attr('transform',
                            'translate(' + margin.left + ',' + margin.top + ')');

          // Invoke the tooltip
          svg.call(self.tip);

          //Define clipping path
          svg.append('clipPath')                  //Make a new clipPath
              .attr('id', 'chart-area')           //Assign an ID
              .append('rect')                     //Within the clipPath, create a new rect
              .attr('width', width)
              .attr('height',height);


          // Keep this around to grab values from for display if needed
          dataset = utils.cloneObject(Oci.data);
          self.createChartData();
          createScales();
          createAxes();
          createLine();
          createData();
        },

        // Will generate chart data for current model and ratio
        createChartData: function () {
          chartData = [];

          // Grab things based on the model we're using
          var params = this.modelParametersView.getModelValues();
          var modelData = {
            info: dataset.info,
            opgee: dataset.opgee[utils.getOPGEEModel(params.water, params.steam, params.flaring)],
            prelim: dataset.prelim[utils.getPRELIMModel(params.refinery)]
          };

          // Loop over each oil
          var oils = Object.keys(modelData.info);
          for (var i = 0; i < oils.length; i++) {
            // Get basic properties from model data
            var info = modelData.info[oils[i]];
            var opgee = modelData.opgee[oils[i]];
            var prelim = modelData.prelim[oils[i]];
            var upstream = +opgee['Net lifecycle emissions'];
            var midstream = utils.getRefiningTotal(prelim);
            var transport = +info[utils.getDatasetKey('transport')];
            var combustion = utils.getCombustionTotal(prelim, params.showCoke);

            // Adjust for any ratio
            upstream = +utils.getValueForRatio(upstream, sortRatio, prelim, params.showCoke, info);
            midstream = +utils.getValueForRatio(midstream, sortRatio, prelim, params.showCoke, info);
            transport = +utils.getValueForRatio(transport, sortRatio, prelim, params.showCoke, info);
            combustion = +utils.getValueForRatio(combustion, sortRatio, prelim, params.showCoke, info);

            // Sum up for total
            var ghgTotal = d3.sum([upstream, midstream, transport, combustion]);

            // Create oil object
            var obj = {
              'id': utils.makeId(info.Unique),
              'name': utils.prettyOilName(info),
              'apiGravity': +info[utils.getDatasetKey('apiGravity')],
              'oilDepth': +info[utils.getDatasetKey('oilDepth')],
              'ghgTotal': ghgTotal,
              'productionVolume': +info[utils.getDatasetKey('productionVolume')],
              'upstream': upstream,
              'midstream': midstream,
              'downstream': combustion + transport,
              'waterToOilRatio': +opgee[utils.getDatasetKey('waterToOilRatio')],
              'gasToOilRatio': +opgee[utils.getDatasetKey('gasToOilRatio')],
              'prodGasoline': +prelim[utils.getDatasetKey('prodGasoline')],
              'prodDiesel': +prelim[utils.getDatasetKey('prodDiesel')],
              'prodBunker': +prelim[utils.getDatasetKey('prodBunker')],
              'sulfurContent': +info[utils.getDatasetKey('sulfurContent')] * 100,
              'yearsProduction': +info[utils.getDatasetKey('yearsProduction')],
              'type': info['Overall Crude Emissions Category'].trim()
            };
            chartData.push(obj);
          }

          // Sort chart data so that higher production volume is last
          chartData.sort(function(a, b) {
            return b.productionVolume - a.productionVolume;
          });
        },

        changeXProperty: function () {
          var options = document.getElementsByName('x-select');
          for (var i = 0; i < options.length; i++) {
            if (options[i].checked) {
              xProperty = options[i].value;
              break;
            }
          }
          self.updateChart('x');
        },

        changeYProperty: function () {
          var options = document.getElementsByName('y-select');
          for (var i = 0; i < options.length; i++) {
            if (options[i].checked) {
              yProperty = options[i].value;
              break;
            }
          }
          self.updateChart('y');
        },

        handleRatioSelect: function () {
          var options = document.getElementsByName('ratio-select');
          var ratio;
          for (var i = 0; i < options.length; i++) {
            if (options[i].checked) {
              ratio = options[i].value;
              sortRatio = ratio;
              break;
            }
          }
          self.createChartData();
          self.updateChart('y');
        },

        updateScales: function() {
          var xMax =
            self.addExtentBuffer(d3.max(chartData, function(d) { return d[xProperty]; }));
          xScale.domain([0, xMax]);
          var yMin = utils.getGlobalExtent(sortRatio, 'min', yProperty);
          var yMax = utils.getGlobalExtent(sortRatio, 'max', yProperty);
          var yExtent = self.addExtentBuffer([yMin, yMax]);
          yScale.domain(yExtent);
          // var rExtent =
          //   self.addExtentBuffer(d3.extent(chartData, function(d) { return d.productionVolume; }));
          // rScale.domain(rExtent);
        },

        updateAxes: function (changedAxis) {
          if (!changedAxis || changedAxis === 'x') {
            //Update x-axis
            svg.select('.x.axis')
              .transition()
              .duration(transitionDuration)
              .call(xAxis);

            // Update x title
            $('.x.axis.title').fadeOut(transitionDuration/2, function () {
              svg.select('.x.axis.subtitle').text(utils.getUnits(xProperty, sortRatio));
              svg.select('.x.axis.title').text(utils.getDatasetName(xProperty));
              $(this).fadeIn(transitionDuration/2);
            });
          }

          if (!changedAxis || changedAxis === 'y') {
            //Update y-axis
            svg.select('.y.axis')
              .transition()
              .duration(transitionDuration)
              .call(yAxis);

            // Update y title

            $('.y.axis.title').fadeOut(transitionDuration/2, function () {
              svg.select('.y.axis.subtitle').text(utils.getUnits(yProperty, sortRatio));
              svg.select('.y.axis.title').text(utils.getDatasetName(yProperty, sortRatio, true));
              $(this).fadeIn(transitionDuration/2);
            });
          }
        },

        updateData: function () {
          svg.selectAll('circle')
             .data(chartData)
             .transition()
             .duration(transitionDuration)
             .attr('cx', function(d) {
              return xScale(d[xProperty]);
             })
             .attr('cy', function(d) {
              return yScale(d[yProperty]);
             });
        },

        updateLine: function () {
          var mapped = chartData.map(function(obj){
            return [xScale(obj[xProperty]),yScale(obj[yProperty])];
          });

          linearRegression = ss.linear_regression()
          .data(mapped).line();

          var r_squared = ss.r_squared(mapped, linearRegression);

          svg.select('.trend')
          .transition()
          .duration(transitionDuration)
          .attr('d', line(xScale.range()))
          .attr('opacity', Math.min(r_squared + .2, 1));
        },

        updateChart: function (changedAxis) {
          self.updateScales();
          self.updateAxes(changedAxis);
          self.updateLine();
          self.updateData();
        },

        handleShare: function (e) {
          e.preventDefault();
        },

        handleResize: function () {
          width = container.width() - margin.left - margin.right;
          height = Math.round(width / aspectRatio);
          // Clear anything in the svg element since we're going to rewrite
          d3.select(chartElement + ' svg').remove();
          self.chartInit();
        },

        showPrices: function (e) {
          e.preventDefault();
          Oci.showPricesModal(true);
        },

        updatePrices: function () {
          // We have new prices, recreate chartData and update chart
          self.createChartData();
          self.updateChart('y');
        },

        handleDropdown: function () {
          $('.config-dropdown').blur();
          self.handleParametersChange();
        },

        handleParametersChange: function () {
          self.createChartData();
          self.updateChart();
        },

        handleParametersToggle: function () {
          $('#model-parameters').toggleClass('open');
        },

        shareOpen: function () {
          var params = self.modelParametersView.getModelValues();
          var url = utils.buildShareURLFromParameters({
            xProperty: xProperty,
            yProperty: yProperty,
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
