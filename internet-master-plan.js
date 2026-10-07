const nyc = await d3.json("./internet-master-plan.json");

const width = 975;
const height = 800;

const metricOptions = [
  "Home Broadband Adoption (Percentage of Households)",
  "Mobile Broadband Adoption (Percentage of Households)",
  "Mobile Dependent Households (Percentage of Households)",
  "Residential Broadband Choice Average by NTA",
  "Commercial Fiber ISP Choice Average by NTA",
  "Percentage of Blocks without a Commercial Fiber Provider",
  "Empire City Subway Coverage (Percentage)",
  "Estimated Aerial Plant Coverage (Percentage)",
  "Estimated Underground Plant Coverage (Percentage)"
];

const container = document.createElement("div");

container.style.position = "relative";
container.style.width = "100%";

const controls = document.createElement("div");

controls.style.display = "flex";
controls.style.alignItems = "center";
controls.style.gap = "10px";
controls.style.marginBottom = "10px";

const label = document.createElement("label");
label.textContent = "Select Category";

const select = document.createElement("select");

for (const option of metricOptions) {
const element = document.createElement("option");

  element.value = option;
  element.textContent = option;

  select.appendChild(element);
}

select.value =
  "Home Broadband Adoption (Percentage of Households)";

controls.appendChild(label);
controls.appendChild(select);

container.appendChild(controls);

const tooltip = document.createElement("div");

tooltip.style.position = "fixed";
tooltip.style.display = "none";
tooltip.style.pointerEvents = "none";
tooltip.style.background = "white";
tooltip.style.border = "1px solid #999";
tooltip.style.borderRadius = "6px";
tooltip.style.padding = "8px 10px";
tooltip.style.fontSize = "13px";
tooltip.style.lineHeight = "1.4";
tooltip.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
tooltip.style.zIndex = "10000";

document.body.appendChild(tooltip);

const svg = d3.create("svg")
  .attr("viewBox", [0, 0, width, height])
  .attr("width", width)
  .attr("height", height)
  .style("display", "block")
  .style("width", "100%")
  .style("height", "auto")
  .style("touch-action", "none")
  .style("cursor", "grab");

container.appendChild(svg.node());


const projection = d3.geoMercator() // projection of map onto world map, fit to NYC proportions
  .fitSize([width, height], nyc);

const path = d3.geoPath(projection);

const satelliteLayer = svg.append('g')
  .attr('class', 'satellite-layer');

const mapLayer = svg.append("g")
  .attr('class', 'map-layer');


const tileSize = 256;

const bounds = d3.geoBounds(nyc);

const topLeft = projection([
  bounds[0][0],
  bounds[1][1]
]);

const bottomRight = projection([
  bounds[1][0],
  bounds[0][1]
]);

// Satellite tile zoom level
const tileZoom = 11;

function lon2tile(lon, zoom) {
  return Math.floor(
    ((lon + 180) / 360) *
    Math.pow(2, zoom)
  );
}

function lat2tile(lat, zoom) {
  const rad = lat * Math.PI / 180;

  return Math.floor(
    (
      1 -
      Math.log(
        Math.tan(rad) +
        1 / Math.cos(rad)
      ) / Math.PI
    ) / 2 *
    Math.pow(2, zoom)
  );
}

const xMin = lon2tile(bounds[0][0], tileZoom);
const xMax = lon2tile(bounds[1][0], tileZoom);

const yMin = lat2tile(bounds[1][1], tileZoom);
const yMax = lat2tile(bounds[0][1], tileZoom);

const tiles = [];

for (let x = xMin; x <= xMax; x++) {
  for (let y = yMin; y <= yMax; y++) {

    const n = Math.pow(2, tileZoom);

    const lonLeft =
      x / n * 360 - 180;

    const lonRight =
      (x + 1) / n * 360 - 180;

    const latTop =
      Math.atan(
        Math.sinh(
          Math.PI * (1 - 2 * y / n)
        )
      ) * 180 / Math.PI;

    const latBottom =
      Math.atan(
        Math.sinh(
          Math.PI * (1 - 2 * (y + 1) / n)
        )
      ) * 180 / Math.PI;

    const p0 = projection([
      lonLeft,
      latTop
    ]);

    const p1 = projection([
      lonRight,
      latBottom
    ]);

    tiles.push({
      x,
      y,
      screenX: p0[0],
      screenY: p0[1],
      width: p1[0] - p0[0],
      height: p1[1] - p0[1]
    });
  }
}

satelliteLayer
  .selectAll("image")
  .data(tiles)
  .join("image")
  .attr(
    "href",
    d =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tileZoom}/${d.y}/${d.x}`
  )
  .attr("x", d => d.screenX)
  .attr("y", d => d.screenY)
  .attr("width", d => d.width + 1)
  .attr("height", d => d.height + 1)
  .attr("preserveAspectRatio", "none");



let selectedNeighborhood = null;
let neighborhoods = null; // initializing
let currentColor = null;

function getValue(d, metric) {
  const rawValue = d.properties[metric];

  if (
    rawValue === null ||
    rawValue === undefined ||
    rawValue === ""
  ) {
    return null;
  }

  const cleaned = String(rawValue)
    .trim()
    .replace(/,/g, "")
    .replace(/%/g, "");  // so percentages aren't lost
  if (cleaned === "") {
    return null;
  }

  const value = Number(cleaned);

  return Number.isFinite(value)
    ? value
    : null;
}

function formatValue(value, metric) {
  if (value === null) {
    return "No data";
  }

  const formatted = value.toLocaleString(
    undefined,
    {
      maximumFractionDigits: 2
    }
  );

  return metric.includes("Percentage") // formats percentages
    ? `${formatted}%`
    : formatted;
}


function updateMap() {
  const metric = select.value; // updates map based on dropdown selection

  const values = nyc.features
    .map(d => getValue(d, metric))
    .filter(value => value !== null); // gets values from CSV document

  currentColor = d3.scaleQuantize()
    .domain(d3.extent(values))  // establishes blue color scheme for values based on their ranges
    .range(d3.schemeBlues[9]);

  neighborhoods = mapLayer
    .selectAll("path")
    .data(nyc.features)
    .join("path")
      .attr("d", path)
      .attr("fill", d => {
        const value = getValue(d, metric);

        return value === null
          ? "#eee"
          : currentColor(value);
      })
      .attr('fill-opacity', d => {
        const value = getValue(d, metric);

        return value === null
          ? 0.15
          : 0.55
      })

      .attr("stroke", "white")
      .attr("stroke-width", 0.75)
      .attr(
        "vector-effect",
        "non-scaling-stroke"
      )


      .style("cursor", "pointer")
      .on("pointerenter", function(event, d) {
        if (selectedNeighborhood !== this) {
          d3.select(this)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
        }

        const metric = select.value;

        const name =
          d.properties[
            "Neighborhood Tabulation Area Name (NTA NAME)"
          ] ?? "Unknown neighborhood";

        const value = getValue(d, metric);

        tooltip.innerHTML = `
          <strong>${name}</strong><br>
          ${metric}: ${formatValue(value, metric)}
        `;

        tooltip.style.display = "block";
      })

      .on("pointermove", function(event) {
        tooltip.style.left =
          `${event.clientX + 14}px`;

        tooltip.style.top =
          `${event.clientY + 14}px`;
      })

      .on("pointerleave", function(event, d) {
        if (selectedNeighborhood !== this) {
          d3.select(this)
            .attr("stroke", "white")
            .attr("stroke-width", 0.75);
        }

        tooltip.style.display = "none";
      })


      .on("click", function(event, d) {
        event.stopPropagation();

        if (
          selectedNeighborhood &&
          selectedNeighborhood !== this
        ) {
          d3.select(selectedNeighborhood)
            .attr("stroke", "white")
            .attr("stroke-width", 0.75);
        }

        selectedNeighborhood = this;

        d3.select(this)
          .attr("stroke", "#fff")
          .attr("stroke-width", 3)
      });
}

//enable map zoom
const zoom = d3.zoom()

  .on("start", () => {
    svg.style("cursor", "grabbing");
    tooltip.style.display = "none";
  })

  .on("zoom", event => {
    mapLayer.attr(
      "transform",
      event.transform
    );

    satelliteLayer.attr(
      "transform",
      event.transform
    );
  })

  .on("end", () => {
    svg.style("cursor", "grab");
  });

svg.call(zoom);

// deselection conditions
svg.on("dblclick.zoom", null);

svg.on("click", () => {
  if (selectedNeighborhood) {
    d3.select(selectedNeighborhood)
      .attr("stroke", "white")
      .attr("stroke-width", 0.75);

    selectedNeighborhood = null;
  }
});

select.addEventListener("change", () => {
  selectedNeighborhood = null;

  tooltip.style.display = "none";

  mapLayer
    .selectAll("path")
    .attr("stroke", "white")
    .attr("stroke-width", 0.75);

  updateMap();
});


updateMap();
document.getElementById("visualization")
    .appendChild(container);
