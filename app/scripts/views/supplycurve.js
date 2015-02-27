/*global Oci, Backbone, JST, d3, utils, ZeroClipboard*/

Oci.Views = Oci.Views || {};

(function () {
    'use strict';

    var self;
    var chartElement = '#supply-curve';
    var margin = {top: 8, right: 8, bottom: 52, left: 64};
    var container;
    var width;
    var height;
    var aspectRatio = 2.5;
    var minProductionDisplayWidth = 40000;
    var xScale;
    var yScale;
    var xAxis;
    var yAxis;
    var svg;
    var dataset;
    var index;
    var origDataset;
    var stackedTotal;

    Oci.Views.SupplyCurve = Backbone.View.extend({

        template: JST['app/scripts/templates/supplycurve.ejs'],

        el: '.content',

        events: {
          'click #left-button': 'goLeft',
          'click #right-button': 'goRight',
          'click .share': 'handleShare'
        },

        initialize: function () {
          self = this;

          $(window).on('resize', self.handleResize);
          $('body').keyup(self.handleKeyUp);

          // Init the tooltip
          this.tip = d3.tip()
            .attr('class', 'd3-tip')
            .html(function(d) {
              var ghgTotal = utils.numberWithCommas(d.ghgTotal);
              var productionVolume = utils.numberWithCommas(d.productionVolume);
              var total = utils.numberWithCommas(d.ghgTotal * d.productionVolume);
              var values = [{
                name: 'Total GHG per barrel',
                value: ghgTotal
              },
              {
                name: 'Production Volume',
                value: productionVolume
              },
              {
                name: 'Total GHG',
                value: total
              }
              ];
              return utils.createTooltipHtml(d.name, d.type, values, d.id, 'A shallow, heavy, and sweet oil located off the California shore.');
            })
            .offset([-10,0]);

          self.render();
        },

        render: function () {
          this.$el.html(this.template());
          this.chartInit();
          this.linkShareButton();
          utils.initDropdown();
        },

        linkShareButton: function () {
          var shareClient = new ZeroClipboard($('#supply-curve-share'));
          shareClient.on('ready', function () {
            shareClient.on('copy', function (event) {
              var clipboard = event.clipboardData;
              var url = utils.buildShareURLFromParameters({});
              clipboard.setData('text/plain', url);
            });

            shareClient.on('aftercopy', function () {
              alert('The shareable URL has been copied to your clipboard.');
            });
          });
        },

        setActiveRect: function () {
          var oil = dataset[index];
          self.setLabelNameAndUrl(oil);
          d3.selectAll('rect').classed('active', false);
          var id = '#index-' + index;
          d3.select(id).classed('active', true);
        },

        formatStackedData: function () {
          stackedTotal = 0;
          dataset.sort(function(a,b) {
            return b.ghgTotal - a.ghgTotal;
          });

          // Build a kind of stacked map data structure, also applying a min width
          dataset.map(function (oil, index, oils) {
            // Set a min display width
            oil.plotProductionVolume = oil.productionVolume < minProductionDisplayWidth ?
              minProductionDisplayWidth : oil.productionVolume;

            // Set a x0 value for stackedness
            if (index === 0) {
              oil.x0 = 0;
            } else {
              oil.x0 = oils[index - 1].x0 + oils[index - 1].plotProductionVolume;
            }

            // Keep track of total for x axis
            stackedTotal += oils[index].plotProductionVolume;
          });
        },

        buildDataset: function (data) {
          var arr = [];

          var oils = Object.keys(data.info);
          for (var i = 0; i < oils.length; i++) {
            var oilInfo = data.info[oils[i]];
            var obj = {
              'id': utils.makeId(oilInfo.Unique),
              'name': utils.prettyOilName(oilInfo),
              'productionVolume': +oilInfo['Oil Production Volume'],
              'ghgTotal': +oilInfo['Total Emissions'],
              'type': oilInfo['Overall Crude Emissions Category'].trim()
            };
            arr.push(obj);
          }

          return arr;
        },

        chartInit: function () {
          var createScales = function() {
            xScale = d3.scale.linear()
                            .domain([0, stackedTotal])
                            .range([0, width]);

            yScale = d3.scale.linear()
                            .domain([0, d3.max(dataset,
                              function(d) {
                                return d.ghgTotal * 1;
                              })])
                            .range([height, 0]);
          };

          var createAxes = function () {
            //Define Y axis
            xAxis = d3.svg.axis()
                      .scale(xScale)
                      .orient('bottom')
                      .ticks(5);

            //Define Y axis
            yAxis = d3.svg.axis()
                      .scale(yScale)
                      .orient('left')
                      .ticks(5);

            //Create Y axis
            svg.append('g')
              .attr('class', 'y axis')
              .attr('transform', 'translate(0,0)')
              .call(yAxis);

            //Create X axis
            svg.append('g')
              .attr('class', 'x axis')
              .attr('transform', 'translate(0,' + (height + 4) + ')')
              .call(xAxis);

            // X axis title
            var g = svg.append('g');
            g.append('title')
              .text(utils.getUnits('productionVolume'))
              .attr('class', 'x axis pop');
            g.append('text')
              .attr('transform', 'translate(' + (width / 2) + ',' +
                (height + margin.bottom - 5) + ')')
              .style('text-anchor', 'middle')
              .attr('class', 'x axis title')
              .text(utils.getDatasetName('productionVolume'));

            // Y axis title
            g = svg.append('g');
            g.append('title')
              .text(utils.getUnits('ghgTotal', 'perBarrel'))
              .attr('class', 'y axis pop');
            g.append('text')
              .attr('transform', 'rotate(-90)')
              .attr('y', -margin.left)
              .attr('x', -(height / 2))
              .attr('dy', '1em')
              .style('text-anchor', 'middle')
              .attr('class', 'y axis title')
              .text(utils.getDatasetName('ghgTotal', 'perBarrel'));
          };

          var createData = function() {
            //Create bars
            svg.selectAll('rect')
               .data(dataset)
               .enter()
               .append('rect')
               .attr('x', function(d) {
                  return xScale(d.x0);
               })
               .attr('y', function(d) {
                  return yScale(d.ghgTotal);
               })
               .attr('width', function(d) {
                  return xScale(d.plotProductionVolume);
               })
               .attr('height', function(d) {
                  return height - yScale(d.ghgTotal);
               })
               .attr('fill', function(d) {
                return utils.categoryColorForType(d.type);
               })
               .attr('opacity', 0.8)
               .attr('id', function(d, i) {
                  return 'index-' + i;
               })
               .on('click', function(d) {
                  self.setLabelNameAndUrl(d);
                  d3.selectAll('rect').classed('active', false);
                  d3.select(this).classed('active', true);
                  var id = d3.select(this).attr('id');
                  index = id.split('-')[1];
               })
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
          };

          // For responsiveness
          container = $('#supply-curve').parent();
          width = container.width() - margin.left - margin.right;
          height = Math.round(width / aspectRatio);

          //Create SVG element
          svg = d3.select('#supply-curve')
                      .append('svg')
                      .attr('width', width + margin.left + margin.right)
                      .attr('height', height + margin.top + margin.bottom)
                    .append('g')
                      .attr('transform',
                            'translate(' + margin.left + ',' + margin.top + ')');

          svg.call(self.tip);

          // Keep this around to grab values from for display if needed
          dataset = self.buildDataset(Oci.data);
          origDataset = dataset;
          self.formatStackedData();
          createScales();
          createAxes();
          createData();

          index = Math.floor(dataset.length / 2);
          self.setActiveRect(index);
        },

        setLabelNameAndUrl: function (oil) {
          var nameLabel = $('#name-label');
          nameLabel.text(oil.name);
          nameLabel.attr('href', '#oil/' + oil.id);
        },

        goLeft: function () {
          index--;
          if (index < 0) { index = dataset.length - 1; }
          self.setActiveRect();
        },

        goRight: function () {
          index++;
          if (index >= dataset.length) { index = 0; }
          self.setActiveRect();
        },

        handleKeyUp: function (event) {
          if (event.keyCode === 37) {
            self.goLeft();
          } else if (event.keyCode === 39) {
            self.goRight();
          }
        },

        handleResize: function () {
          width = container.width() - margin.left - margin.right;
          height = Math.round(width / aspectRatio);
          d3.select(chartElement + ' svg').remove();
          self.chartInit();
        },

        handleShare: function (e) {
          e.preventDefault();
        },

        shareOpen: function () {
          var url = utils.buildShareURLFromParameters({});
          $('#some-value').attr('value', url)
        }
    });
})();
