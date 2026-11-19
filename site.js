"use strict";

const scenes = ["学习/工作间隙", "情绪低落时", "追剧/游戏时", "运动后", "通勤途中"];
const shortScenes = ["学习/工作\n间隙", "情绪低落时", "追剧/游戏时", "运动后", "通勤途中"];
const motives = ["短暂放松", "满足甜食欲", "控制糖摄入", "便携补给"];
const shortMotives = ["短暂放松", "满足\n甜食欲", "控制\n糖摄入", "便携补给"];
const colors = ["#eef3da", "#c2dcab", "#83b897", "#438b74", "#1e5b4c"];
const paper = "#fbf8ef";
const ink = "#183b32";
const get = id => document.getElementById(id);
const target = get("heatmap");
const role = get("role");
const metric = get("metric");
const chartStatus = get("chart-status");
const exportButton = get("export");
const insight = get("chart-insight");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const percent = (count, total) => total ? (count * 100 / total).toFixed(1) + "%" : "—";

function aggregate(records, group) {
  const matrix = scenes.map(() => motives.map(() => 0));
  for (const row of records) {
    if (group && row.身份 !== group) continue;
    matrix[scenes.indexOf(row.最常消费场景)][motives.indexOf(row.首要购买动机)]++;
  }
  return matrix;
}

function chartOption(matrix, totals, group, share, compact) {
  const total = totals.reduce((sum, value) => sum + value, 0);
  const cells = matrix.flatMap((row, y) => row.map((count, x) => {
    const value = share ? (totals[y] ? +(count * 100 / totals[y]).toFixed(1) : 0) : count;
    const white = value >= (share ? 75 : 23);
    return { value: [x, y, value, count], label: { color: white ? "#fffdf7" : "#0d281f" } };
  }));
  return {
    backgroundColor: paper,
    textStyle: { fontFamily: "Microsoft YaHei, PingFang SC, sans-serif", color: ink },
    title: {
      left: compact ? 9 : 17,
      top: 12,
      text: "消费场景 × 首要购买动机",
      subtext: (group || "全部人群") + " · AI 模拟 · n = " + total + " · " + (share ? "场景内占比" : "人数"),
      textStyle: { color: ink, fontSize: compact ? 16 : 22 },
      subtextStyle: { color: "#52695f", fontSize: compact ? 11 : 13 }
    },
    grid: { left: compact ? 70 : 142, right: compact ? 6 : 24, top: compact ? 108 : 111, bottom: 61 },
    xAxis: {
      type: "category", position: "top", data: motives,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: {
        interval: 0, margin: 11, fontWeight: "bold", color: ink,
        fontSize: compact ? 11 : 14, lineHeight: 15,
        formatter: (value, index) => compact ? shortMotives[index] : value
      }
    },
    yAxis: {
      type: "category", inverse: true, data: scenes,
      axisTick: { show: false }, axisLine: { show: false },
      axisLabel: {
        interval: 0, margin: compact ? 5 : 8, color: ink,
        fontSize: compact ? 11 : 13, lineHeight: 15,
        formatter: (value, index) => compact ? shortScenes[index] : value + " · " + totals[index]
      }
    },
    visualMap: {
      min: 0, max: share ? 100 : 30, dimension: 2, orient: "horizontal", left: "center", bottom: 13,
      itemWidth: 12, itemHeight: 110, text: share ? ["100%", "0%"] : ["30 人", "0 人"],
      inRange: { color: colors }, textStyle: { color: "#355e50", fontSize: 12 }
    },
    tooltip: {
      trigger: "item", renderMode: "richText", confine: true, showDelay: 35, transitionDuration: 0.15,
      backgroundColor: ink, borderWidth: 0, padding: [9, 12],
      textStyle: { color: "#fffdf7", fontSize: 13, lineHeight: 20 },
      formatter: ({ value: [x, y, , count] }) => scenes[y] + " × " + motives[x] + "\n" +
        count + " 人 · 占该场景 " + percent(count, totals[y]) + "\n占当前样本 " + percent(count, total)
    },
    animation: !reduceMotion.matches,
    animationDuration: 420,
    stateAnimation: { duration: reduceMotion.matches ? 0 : 170, easing: "cubicOut" },
    series: [{
      type: "heatmap", data: cells, selectedMode: "single",
      label: {
        show: true, fontSize: compact ? 12 : 19, fontWeight: "bold",
        formatter: ({ value: [, y, value, count] }) => share ? (totals[y] ? value + "%" : "—") : count
      },
      itemStyle: { borderColor: paper, borderWidth: compact ? 3 : 5, borderRadius: 8 },
      emphasis: { itemStyle: { borderColor: "#b58336", borderWidth: 3, shadowBlur: 13, shadowColor: "rgba(24,59,50,.32)" } },
      select: { itemStyle: { borderColor: ink, borderWidth: 3 } }
    }]
  };
}

function fillTable(matrix, totals, share) {
  const table = get("chart-table");
  table.tHead.replaceChildren(document.createElement("tr"));
  const headerRow = table.tHead.rows[0];
  for (const label of ["最常消费场景", ...motives, "场景人数"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  }
  const body = table.tBodies[0];
  body.replaceChildren();
  for (const [index, scene] of scenes.entries()) {
    const row = body.insertRow();
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = scene;
    row.append(label);
    for (const count of matrix[index]) {
      row.insertCell().textContent = share ? percent(count, totals[index]) : count;
    }
    row.insertCell().textContent = totals[index];
  }
}

async function start() {
  const response = await fetch("assets/survey.json");
  if (!response.ok) throw new Error("Could not load the survey data");
  const { 逐条作答: records } = await response.json();
  const chart = echarts.init(target);
  let compact = target.clientWidth < 565;
  let totals;

  function render() {
    const matrix = aggregate(records, role.value);
    totals = matrix.map(row => row.reduce((sum, count) => sum + count, 0));
    const total = totals.reduce((sum, count) => sum + count, 0);
    const share = metric.value === "share";
    chart.setOption(chartOption(matrix, totals, role.value, share, compact), { notMerge: true });
    fillTable(matrix, totals, share);
    insight.hidden = true;
    chartStatus.textContent = (role.value || "全部人群") + " · " + total + " 份模拟答卷 · " +
      (share ? "格内人数除以该场景总人数。" : "颜色越深，该组合人数越多。") + " 可悬停查看或点选格子。";
  }

  chart.on("click", "series.heatmap", ({ value: [x, y, , count] }) => {
    get("detail-label").textContent = scenes[y] + " × " + motives[x];
    get("detail-value").textContent = count + " 人";
    get("detail-foot").textContent = "占该场景 " + percent(count, totals[y]) +
      " · 占当前样本 " + percent(count, totals.reduce((sum, value) => sum + value, 0));
    insight.hidden = false;
  });
  chart.on("selectchanged", event => {
    if (!event.selected.length) insight.hidden = true;
  });

  role.addEventListener("change", render);
  metric.addEventListener("change", render);
  exportButton.addEventListener("click", () => {
    chart.dispatchAction({ type: "hideTip" });
    const link = document.createElement("a");
    link.href = chart.getDataURL({ type: "png", pixelRatio: 3, backgroundColor: paper });
    link.download = "低糖治愈零食_热力图_" + (role.value || "全部人群") +
      "_" + (metric.value === "share" ? "场景内占比" : "人数") + ".png";
    link.click();
  });
  const resize = new ResizeObserver(() => {
    chart.resize();
    const next = target.clientWidth < 565;
    if (next !== compact) {
      compact = next;
      render();
    }
  });
  resize.observe(target);
  render();
  exportButton.disabled = false;
}

start().catch(error => {
  chartStatus.textContent = "图表加载失败。刷新页面可重试，也可在页尾下载原始数据。";
  console.error(error);
});
