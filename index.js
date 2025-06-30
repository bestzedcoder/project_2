// 1. Định nghĩa khu vực nghiên cứu
var hanoiCenter = ee.Geometry.Point([105.8187, 21.053]); // Hồ Hoàn Kiếm
var urbanRadius = 10000; // 20km cho nội đô
var suburbanRadius = 15000; // 30km cho ngoại ô

// Tạo các vùng nghiên cứu
var urbanArea = hanoiCenter.buffer(urbanRadius);
var suburbanArea = hanoiCenter.buffer(suburbanRadius).difference(urbanArea);

// Hiển thị khu vực nghiên cứu
Map.centerObject(hanoiCenter, 10);
Map.addLayer(urbanArea, { color: "red", opacity: 0.2 }, "Nội đô (0-10km)");
Map.addLayer(
  suburbanArea,
  { color: "blue", opacity: 0.2 },
  "Ngoại ô (10-15km)"
);

// 2. Hàm tính LST từ Landsat 8
function calculateLST(image) {
  // Chuyển đổi từ DN sang nhiệt độ Celsius
  var lst = image
    .select("ST_B10")
    .multiply(0.00341802)
    .add(149.0)
    .subtract(273.15)
    .rename("LST");

  // Áp dụng QA_PIXEL mask để loại bỏ mây, bóng mây
  var qa = image.select("QA_PIXEL");
  var cloudMask = qa.bitwiseAnd(1 << 3).eq(0); // Bit 3: Cloud
  var shadowMask = qa.bitwiseAnd(1 << 4).eq(0); // Bit 4: Cloud Shadow

  return image.addBands(lst.updateMask(cloudMask.and(shadowMask)));
}

// 3. Hàm lấy dữ liệu hàng năm
function getAnnualData(year) {
  // Lọc ảnh tháng 9 hàng năm (ít mây nhất)
  var startDate = ee.Date.fromYMD(year, 9, 1);
  var endDate = startDate.advance(1, "month");

  var collection = ee
    .ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterBounds(suburbanArea)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt("CLOUD_COVER", 30))
    .map(calculateLST);

  // Tính trung vị và gán năm
  return collection.median().set("year", year).set("count", collection.size());
}

// 4. Tạo chuỗi thời gian 2013-2023
var years = ee.List.sequence(2013, 2023);
var annualLST = ee.ImageCollection.fromImages(
  years.map(function (year) {
    return getAnnualData(ee.Number(year));
  })
);

// 5. Phân tích nhiệt độ theo vùng
function analyzeTemperature(region, name) {
  // Tính toán thống kê
  var stats = annualLST.map(function (image) {
    var stats = image.reduceRegion({
      reducer: ee.Reducer.mean().combine({
        reducer2: ee.Reducer.stdDev(),
        sharedInputs: true,
      }),
      geometry: region,
      scale: 100, // Giảm độ phân giải để tăng tốc
      maxPixels: 1e9,
    });

    return ee.Feature(null, {
      year: image.get("year"),
      count: image.get("count"),
      mean: stats.get("LST_mean"),
      stdDev: stats.get("LST_stdDev"),
    });
  });

  // Tạo biểu đồ
  var chart = ui.Chart.feature
    .byFeature({
      features: ee.FeatureCollection(stats),
      xProperty: "year",
      yProperties: ["mean"],
    })
    .setOptions({
      title: "Nhiệt độ trung bình tháng 9 tại " + name + " (2013-2023)",
      hAxis: { title: "Năm" },
      vAxis: { title: "Nhiệt độ (°C)" },
      lineWidth: 2,
      pointSize: 4,
      series: { 0: { color: name === "Nội đô" ? "red" : "blue" } },
    });

  return chart;
}

// 6. Tính toán chênh lệch nhiệt độ
function analyzeUrbanHeatIsland() {
  var deltaStats = annualLST.map(function (image) {
    var urbanMean = image
      .reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: urbanArea,
        scale: 100,
        maxPixels: 1e9,
      })
      .get("LST");

    var suburbanMean = image
      .reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: suburbanArea,
        scale: 100,
        maxPixels: 1e9,
      })
      .get("LST");

    return ee.Feature(null, {
      year: image.get("year"),
      delta: ee.Number(urbanMean).subtract(suburbanMean),
      urban: urbanMean,
      suburban: suburbanMean,
    });
  });

  // Biểu đồ chênh lệch
  var deltaChart = ui.Chart.feature
    .byFeature({
      features: ee.FeatureCollection(deltaStats),
      xProperty: "year",
      yProperties: ["delta"],
    })
    .setOptions({
      title: "Hiệu ứng đảo nhiệt đô thị Hà Nội (2013-2023)",
      hAxis: { title: "Năm" },
      vAxis: { title: "Chênh lệch nhiệt độ (°C)" },
      lineWidth: 2,
      pointSize: 4,
      series: { 0: { color: "purple" } },
    });

  return deltaChart;
}

// 7. Hiển thị kết quả
print("Phân tích nhiệt độ đô thị Hà Nội");
print(analyzeTemperature(urbanArea, "Nội đô"));
print(analyzeTemperature(suburbanArea, "Ngoại ô"));
print(analyzeUrbanHeatIsland());

// 8. Xuất dữ liệu để phân tích sâu
Export.table.toDrive({
  collection: annualLST.map(function (image) {
    return ee.Feature(null, {
      year: image.get("year"),
      image_id: image.id(),
      count: image.get("count"),
    });
  }),
  description: "LST_Image_List",
  fileFormat: "CSV",
});

// Xuất dữ liệu thống kê nhiệt độ chi tiết
var statsCollection = ee.FeatureCollection(
  annualLST.map(function (image) {
    // Tính toán thống kê cho nội đô
    var urbanStats = image.reduceRegion({
      reducer: ee.Reducer.mean().combine({
        reducer2: ee.Reducer.stdDev(),
        sharedInputs: true,
      }),
      geometry: urbanArea,
      scale: 100,
      maxPixels: 1e9,
    });

    // Tính toán thống kê cho ngoại ô
    var suburbanStats = image.reduceRegion({
      reducer: ee.Reducer.mean().combine({
        reducer2: ee.Reducer.stdDev(),
        sharedInputs: true,
      }),
      geometry: suburbanArea,
      scale: 100,
      maxPixels: 1e9,
    });

    return ee.Feature(null, {
      year: image.get("year"),
      urban_mean: urbanStats.get("LST_mean"),
      urban_stddev: urbanStats.get("LST_stdDev"),
      suburban_mean: suburbanStats.get("LST_mean"),
      suburban_stddev: suburbanStats.get("LST_stdDev"),
      temperature_difference: ee
        .Number(urbanStats.get("LST_mean"))
        .subtract(suburbanStats.get("LST_mean")),
      image_count: image.get("count"),
    });
  })
);

// Xuất dữ liệu ra Google Drive
Export.table.toDrive({
  collection: statsCollection,
  description: "Hanoi_LST_Statistics_2013_2023",
  fileFormat: "CSV",
  selectors: [
    "year",
    "urban_mean",
    "urban_stddev",
    "suburban_mean",
    "suburban_stddev",
    "temperature_difference",
    "image_count",
  ],
});

// 9. Xuất ảnh LST với bảng màu nhiệt độ
function exportLSTImages() {
  // Xác định bảng màu cho LST (nhiệt độ °C)
  var lstPalette = [
    "040274",
    "040281",
    "0502a3",
    "0502b8",
    "0502ce",
    "0502e6",
    "0602ff",
    "235cb1",
    "307ef3",
    "269db1",
    "30c8e2",
    "32d3ef",
    "3be285",
    "3ff38f",
    "86e26f",
    "3ae237",
    "b5e22e",
    "d6e21f",
    "fff705",
    "ffd611",
    "ffb613",
    "ff8b13",
    "ff6e08",
    "ff500d",
    "ff0000",
    "de0101",
    "c21301",
    "a71001",
    "911003",
  ].reverse(); // Đảo ngược để nhiệt độ cao màu đỏ

  // Lặp qua từng năm để xuất ảnh
  years.getInfo().forEach(function (year) {
    var image = annualLST.filter(ee.Filter.eq("year", year)).first();

    // Kiểm tra xem ảnh có tồn tại không
    if (image) {
      var lst = image.select("LST");

      // Thêm bảng màu vào ảnh
      var lstVisualized = lst.visualize({
        min: 20, // Nhiệt độ tối thiểu (°C)
        max: 45, // Nhiệt độ tối đa (°C)
        palette: lstPalette,
      });

      // Xuất ảnh LST
      Export.image.toDrive({
        image: lstVisualized,
        description: "LST_Hanoi_" + year,
        folder: "LST_Hanoi", // Thư mục trên Google Drive
        region: urbanArea.union(suburbanArea),
        scale: 100, // Độ phân giải 100m
        maxPixels: 1e9,
        fileFormat: "GeoTIFF",
        formatOptions: {
          cloudOptimized: true,
        },
      });

      // Thêm ảnh vào bản đồ để xem trước
      Map.addLayer(
        lst,
        {
          min: 20,
          max: 45,
          palette: lstPalette,
        },
        "LST " + year
      );
    }
  });
}

// Chạy hàm xuất ảnh
exportLSTImages();

// Thêm thanh màu vào bản đồ
var legend = ui.Panel({
  style: {
    position: "bottom-right",
    padding: "8px 15px",
  },
});

var legendTitle = ui.Label({
  value: "Nhiệt độ (°C)",
  style: {
    fontWeight: "bold",
    fontSize: "18px",
    margin: "0 0 4px 0",
    padding: "0",
  },
});

legend.add(legendTitle);

// Tạo thanh màu
var makeColorBarParams = {
  color: lstPalette,
  min: 20,
  max: 45,
  width: 300,
  height: 15,
};

var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams,
  style: { margin: "0 0 8px 0" },
});

legend.add(colorBar);

// Thêm giá trị min/max
var legendLabels = ui.Panel({
  widgets: [
    ui.Label("20°C", { margin: "0 0 0 0" }),
    ui.Label("32.5°C", { margin: "0 0 0 110px" }),
    ui.Label("45°C", { margin: "0 0 0 110px" }),
  ],
  layout: ui.Panel.Layout.flow("horizontal"),
});

legend.add(legendLabels);
Map.add(legend);
