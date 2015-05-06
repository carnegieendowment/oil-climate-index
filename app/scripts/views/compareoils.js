/*global Oci, Backbone, JST, d3, utils, ZeroClipboard*/

Oci.Views = Oci.Views || {};

(function () {
    'use strict';

    var self;
    var chartElement = '#compare-oils';
    var transitionDuration = 1500;
    var margin = {top: 72, right: 12, bottom: 0, left: 8};
    var container;
    var width;
    var height;
    var barHeight = 40;
    var metrics = ['upstream', 'midstream', 'downstream'];

    // Defaults
    var sortOrderDescending;
    var sortStep;
    var sortRatio;

    var xScale;
    var yScale;
    var processScale;
    var yAxis;
    var xAxis;
    var svg;
    var dataset;
    var chartData;
    var groups;
    var groupInfo;
    var groupOrder;

    Oci.Views.CompareOils = Backbone.View.extend({

        template: JST['app/scripts/templates/compareoils.ejs'],

        el: '.content',

        events: {
          'click #compare-oils-share': 'handleShare',
          'click #price-button': 'showPrices',
          'change #toggle-petcoke': 'handleParametersChange',
          'change .slider': 'handleParametersChange',
          'change .config-dropdown': 'handleDropdown',
          'click .mp-summary': 'handleParametersToggle'
        },

        initialize: function () {
          self = this;

          sortOrderDescending = true;
          sortStep = 'ghgTotal';
          sortRatio = 'perBarrel';

          // Init the tooltip
          this.tip = d3.tip()
            .attr('class', 'd3-tip')
            .html(function(d) {
              var values = chartData.map(function(step){
                var match = _.find(step, function(oil){
                  return oil.y === d.y;
                });
                return {
                  name: utils.capitalize(match.step),
                  value: match.x < 1 ? match.x.toFixed(2) : match.x.toFixed(0),
                  units: ''
                };
              });
              // Add total value to tooltip
              values.unshift({ name: 'Total', value: utils.numberWithCommas(d.ghgTotal, sortRatio), units: utils.getUnits('ghgTotal', sortRatio) });
              return utils.createTooltipHtml(d.y, d.type, values, utils.makeId(d.y));
            })
            .offset([0,0]);

          this.render();

          $(window).on('resize', self.handleResize);
          $('#sort-select').change(this.handleSortSelect);
          $('#step-select').change(this.handleStepSelect);
          $('#ratio-select').change(this.handleRatioSelect);

          $(window).on('load', self.checkDataControlsPosition);
          $(window).on('scroll', self.checkDataControlsPosition);
        },

        parseURLAndSetState: function () {
          // Handle any parameters we're interested in catching here
          var params = utils.parseParametersFromShareURL(window.location.href);

          // Handle url update - http://stackoverflow.com/questions/17550059/backbone-js-change-url-without-reloading-the-page
          window.history.pushState('', '', window.location.hash.split('?')[0]);

          // Set sort ratio
          if (params.sortRatio) {
            sortRatio = params.sortRatio;
            utils.setInputFieldOption('ratio-select', sortRatio);
          }

          // Set selected step
          if (params.sortStep) {
            sortStep = params.sortStep;
            utils.setInputFieldOption('step-select', sortStep);
          }

          // Set sort order
          if (params.sortOrderDescending) {
            sortOrderDescending = params.sortOrderDescending === 'true' ? true : false;
            utils.setInputFieldOption('sort-select', params.sortOrderDescending);
          }

          // Set model parameters
          if (params.opgee || params.prelim || params.showCoke) {
            self.modelParametersView.setModelParameters(params);
          }
        },

        linkShareButton: function () {
          var shareClient = new ZeroClipboard($('#compare-oils-share'));
          shareClient.on('ready', function () {
            shareClient.on('copy', function (event) {
              var clipboard = event.clipboardData;
              var params = self.modelParametersView.getModelValues();
              var url = utils.buildShareURLFromParameters({
                sortOrderDescending: sortOrderDescending,
                sortStep: sortStep,
                sortRatio: sortRatio,
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
          this.checkDataControlsPosition();
        },

        checkDataControlsPosition: function() {
          var $element = $('#compare-oils-view .data-controls');
          if (!$element.length) { return; }

          var wrapperOffset = $('.panel-aside').offset();

          var parentSection = $('#co-chart-cont');
          var parentSectionHeight = parentSection.outerHeight();
          var bottomLimit = parentSectionHeight + parentSection.offset().top;
          var h = bottomLimit - $(window).scrollTop();
          // Element height can never be higher than the parent's height.
          h = h > parentSectionHeight ? parentSectionHeight : h;

          if ($(window).scrollTop() >= wrapperOffset.top) {
            $element
              .addClass('sticky')
              .width($('.panel-aside').outerWidth())
              .outerHeight(h);
          }
          else {
            $element
              .removeClass('sticky')
              .width('')
              .outerHeight('');
          }
        },

        createChartData: function() {
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
            upstream = +utils.getValueForRatio(upstream, sortRatio, prelim, params.showCoke);
            midstream = +utils.getValueForRatio(midstream, sortRatio, prelim, params.showCoke);
            transport = +utils.getValueForRatio(transport, sortRatio, prelim, params.showCoke);
            combustion = +utils.getValueForRatio(combustion, sortRatio, prelim, params.showCoke);

            // Sum up for total
            var ghgTotal = d3.sum([upstream, midstream, transport, combustion]);

            // Create oil object
            var obj = {
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
              'type': info['Overall Crude Emissions Category'].trim()
            };
            chartData.push(obj);
          }

          // Sort it accordingly
          self.sortByField(chartData, sortStep, sortOrderDescending);

          // Gather just the data we need
          chartData = metrics.map(function(metric) {
            return chartData.map(function(d) {
              return {
                x: d.name,
                y: d[metric],
                type: d.type,
                ghgTotal: d.ghgTotal
              };
            });
          });

          var stack = d3.layout.stack();
          stack(chartData);
          chartData = chartData.map(function (group) {
            return group.map(function (d) {
              // Invert the x and y values, and y0 becomes x0
              return { x: d.y, y: d.x, x0: d.y0 ,
                        type: d.type, ghgTotal: d.ghgTotal }; });
          });
        },

        sortByField: function(data, field, descending) {

          groups = _.groupBy(data, 'type');
          groupInfo = [];
          _.each(groups, function(group, key){
            var obj = {}
            obj.name = key
            obj.avgGhgTotal = _.pluck(group,'ghgTotal').reduce(function(a,b){ return a + b; }) / (group.length)
            groupInfo.push(obj)
          })
          groupInfo.sort(function(a, b) {
            return a.avgGhgTotal - b.avgGhgTotal;
          });
          groupOrder = groupInfo.map(function(group){ return group.name; });
          data.sort(function(a, b) {
            if (field === 'type') {

              // first sort by index of type (it's sorted by group average ghgTotal) then individual ghgTotal
              // switch sign if descending
              return ((groupOrder.indexOf(a.type) * 1000000 + a.ghgTotal) - (groupOrder.indexOf(b.type) * 1000000 + b.ghgTotal)) * (1 - 2 * Number(descending))
            } else {
              // switch sign if descending
              return (a[field] - b[field]) * (1 - 2 * Number(descending));
            }
          });
        },

        chartInit: function () {
          var createScales = function() {
            var xMax = utils.getGlobalExtent(sortRatio, 'max');
            xScale = d3.scale.linear()
                       .domain([0, xMax])
                       .range([0, width])
                       .nice();
            var oilNames = chartData[0].map(function (d) {
                  return d.y;
            });
            yScale = d3.scale.ordinal()
                       .domain(oilNames)
                       .rangeRoundBands([0, height], 0.05);

            // The opacity scale for process step
            processScale = d3.scale.ordinal()
                       .domain(['upstream', 'midstream', 'downstream'])
                       .rangePoints([1, 0.4]);
          };

          var createData = function () {
              //Create bars
              var groups = svg.selectAll('g')
                    .data(chartData)
                    .enter()
                    .append('g')
                    .classed('step', true)
                    .attr('class', function (d, i) {
                      return 'step ' + metrics[i];
                    });

              groups.selectAll('rect')
                .data(function (d, i) {
                  d.map(function (oil) {
                    oil.step = metrics[i];
                  });
                  return d;
                }, function (d) {
                  return d.y;
                })
                .enter()
                .append('rect')
                .attr('x', function (d) {
                  return xScale(d.x0);
                })
                .attr('y', function (d) {
                  return yScale(d.y);
                })
                .attr('height', function () {
                  return yScale.rangeBand();
                })
                .attr('width', function (d) {
                  return xScale(d.x);
                })
                .attr('fill', function (d) {
                  return utils.categoryColorForType(d.type);
                })
                .attr('opacity', function (d) {
                  return processScale(d.step);
                })
                .on('mouseover', function(d){
                  self.tip.show(d);
                  $('.swatch').css('background',utils.categoryColorForType(d.type));
                  $('.stats-list dt:contains("' + utils.capitalize(d.step) + '")').css('color','orange');
                  $('.stats-list dt:contains("' + utils.capitalize(d.step) + '")').next().css('color','orange');
                  $('.stats-list dt:contains("Total")').addClass('total');
                  $('.stats-list dt:contains("Total")').next().addClass('total');
                })
                .on('mouseleave', function(){
                  if (utils.insideTooltip(d3.event.clientX, d3.event.clientY)) {
                   $('.d3-tip').on('mouseleave', function() {
                     self.tip.hide();
                   });
                  }
                  else {
                    self.tip.hide();
                  }
                });
          };

          var createAxes = function() {
            xAxis = d3.svg.axis()
                      .scale(xScale)
                      .orient('top');

            yAxis = d3.svg.axis()
                          .scale(yScale)
                          .orient('right');

            svg.append('g')
               .attr('class', 'y axis')
               .call(yAxis);

            // Y axis - no hover
            svg.selectAll('.y.axis text').attr('pointer-events', 'none')

            svg.append('g')
              .attr('class', 'x axis')
              .call(xAxis);

            // X axis title
            var g = svg.append('g');
            g.append('text')
              .attr('transform', 'translate(' + (width / 2) + ',' +
                -60 + ')')
              .style('text-anchor', 'middle')
              .attr('class', 'x axis title')
              .text(self.getXAxisTitle());
            g.append('text')
              .attr('transform', 'translate(' + (width / 2) + ',' +
                -40 + ')')
              .style('text-anchor', 'middle')
              .attr('class', 'x axis title subtitle')
              .text(utils.getUnits('ghgTotal', sortRatio));
          };

          // For responsiveness
          container = $(chartElement);
          width = container.width() - margin.left - margin.right;

          //Create SVG element
          svg = d3.select(chartElement)
                      .append('svg')
                      .attr('width', width + margin.left + margin.right)
                    .append('g')
                      .attr('transform',
                            'translate(' + margin.left + ',' + margin.top + ')');

          svg.call(self.tip);

          // Keep this around to grab values from for display if needed
          dataset = utils.cloneObject(Oci.data);

          var numOils = Object.keys(Oci.data.info).length;

          // Set height
          height = barHeight * numOils;
          d3.select(chartElement + ' svg').attr('height', height + margin.top + margin.bottom);
          self.createChartData();
          createScales();
          createData();
          createAxes();
        },

        handleSortSelect: function () {
          sortOrderDescending = !sortOrderDescending;
          self.createChartData();
          self.updateChart(false, false);
        },

        handleStepSelect: function () {
          var options = document.getElementsByName('step-select');
          var step;
          for (var i = 0; i < options.length; i++) {
            if (options[i].checked) {
              step = options[i].value;
              sortStep = step;
              break;
            }
          }
          self.createChartData();
          self.updateChart(false, false);
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
          self.updateChart(true, true);
        },

        updateChart: function (updateMax, animate) {
          self.updateScales(updateMax);
          self.updateAxes(animate);
          self.updateData();
        },

        updateData: function() {
          // Create bars
          var groups = svg.selectAll('.step')
                .data(chartData);
          groups.selectAll('rect')
            .data(function (d, i) {
              d.map(function (oil) {
                oil.step = metrics[i];
              });
              return d;
            }, function (d) {
              return d.y;
            })
            .transition()
            .duration(transitionDuration)
            .attr('x', function (d) {
              return xScale(d.x0);
            })
            .attr('y', function (d) {
              return yScale(d.y);
            })
            .attr('height', function () {
              return yScale.rangeBand();
            })
            .attr('width', function (d) {
              return xScale(d.x);
            });
        },

        updateScales: function (updateMax) {
          if (updateMax !== false) {
            var xMax = utils.getGlobalExtent(sortRatio, 'max');
            xScale.domain([0, xMax])
              .nice();
          }

          var oilNames = chartData[0].map(function (d) {
                return d.y;
          });
          yScale.domain(oilNames);
        },

        updateAxes: function (animate) {
          svg.select('.y.axis')
            .transition()
            .duration(transitionDuration)
            .call(yAxis);

          svg.select('.x.axis')
            .transition()
            .duration(transitionDuration)
            .call(xAxis);

          // Update x title with animation if called for
          if (animate) {
            $('.x.axis.title').fadeOut(transitionDuration/2, function () {
              svg.select('.x.axis.subtitle').text(utils.getUnits(sortStep, sortRatio));
              svg.select('.x.axis.title').text(self.getXAxisTitle());
              $(this).fadeIn(transitionDuration/2);
            });
          }
        },

        handleShare: function (e) {
          e.preventDefault();
        },

        showPrices: function (e) {
          e.preventDefault();
          Oci.showPricesModal(true);
        },

        updatePrices: function () {
          // We have new prices, recreate dataset and update chart
          self.createChartData();
          self.updateChart(true, false);
        },

        handleResize: function () {
          width = container.width() - margin.left - margin.right;
          // Clear anything in the svg element since we're going to rewrite
          d3.select(chartElement + ' svg').remove();
          self.chartInit();
        },

        getXAxisTitle: function () {
          return utils.getDatasetName(sortStep, sortRatio);
        },

        handleDropdown: function () {
          $('.config-dropdown').blur();
          self.handleParametersChange();
        },

        handleParametersChange: function () {
          self.createChartData();
          self.updateChart(false, false);
        },

        handleParametersToggle: function () {
          $('#model-parameters').toggleClass('open');
        },

        shareOpen: function () {
          var params = self.modelParametersView.getModelValues();
          var url = utils.buildShareURLFromParameters({
            sortOrderDescending: sortOrderDescending,
            sortStep: sortStep,
            sortRatio: sortRatio,
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
