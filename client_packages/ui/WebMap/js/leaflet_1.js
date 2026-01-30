

CUSTOM_CRS = L.extend({}, L.CRS.Simple, {
    projection: L.Projection.LonLat,
    scale: zoom => Math.pow(2, zoom),
    distance: (pos1, pos2) => {
        const xDiff = pos2.lng - pos1.lng
        const yDiff = pos2.lat - pos1.lat
        return Math.sqrt(xDiff * xDiff + yDiff * yDiff)
    },
    transformation: new L.Transformation(.01423,58.89,-.01423,119.4),
    infinite: true
});


var SateliteStyle = L.tileLayer('/images/map/{z}/{x}x{y}.png', {minZoom: 2,maxZoom: 6, noWrap: true, continuousWorld: false, id: 'map'});

var ExampleGroup = L.layerGroup();

var Icons = {
	"Example" :ExampleGroup,
};

var mymap = L.map('map', {
    crs: CUSTOM_CRS,
    minZoom: 2,
    maxZoom: 6,
    zoom: 4,
    maxNativeZoom: 0,
    preferCanvas: true,
    layers: [SateliteStyle, ExampleGroup],
    center: [0, 0],
    attributionControl: false,
    zoomControl: false,
    scrollWheelZoom: true,
});


L.control.zoom({
    position:'topright'
}).addTo(mymap);


function customIcon(icon){
	return L.icon({
		iconUrl: `/images/blips/${icon}.png`,
		iconSize:     [30, 30],
		iconAnchor:   [15, 20], 
		popupAnchor:  [0, -25]
	});
}

let defaultBlips = 
[
    { name: "Работа Электрик", x: 734.63855, y: 128.54727, blip: "job-1" },
    { name: "Работа Автобусник", x: 432.01242, y: -628.3286, blip: "job-1" },
    { name: "Работа Инкассатор", x: 46.437027, y: -842.20435, blip: "job-1" },
    { name: "Работа Почтальон", x: -197.82831, y: 6235.436, blip: "job-1" },
    { name: "Работа Почтальон", x: -197.82831, y: 6235.436, blip: "job-1" },
    { name: "Работа Газонокосильщик", x: -1331.847, y: 41.47328, blip: "job-1" },
    { name: "Работа Такси", x: 900.21326, y: -173.38603, blip: "job-1" },
    { name: "Работа Развозчик товаров", x: 1737.877, y: 3709.549, blip: "job-1" },

    // { name: "LSPD", x: 458.25644, y: -999.1341, blip: "lspd" },
    // { name: "EMS", x: 306.5991, y: -600.5723, blip: "ems" },
    // { name: "Goverment", x: -516.47943, y: -181.97893, blip: "government" },
    // { name: "Weazel News", x: -563.7617, y: -934.2492, blip: "weazle-news" },

    // { name: "Families", x: -199.28838, y: -1584.5262, blip: "famillies" },
    // { name: "Ballas", x: 119.04292, y: -1966.3086, blip: "ballas" },
    // { name: "Vagos", x: 1403.206, y: -1483.664, blip: "vagos" },
    // { name: "Marabunta", x: 949.50433, y: -2151.384, blip: "marabunta" },
    // { name: "Bloods", x: 489.85736, y: -1528.8881, blip: "bloods" },

];

for(let i = 0; i < defaultBlips.length; i++)
{
    L.marker([defaultBlips[i].y, defaultBlips[i].x], {icon: customIcon(defaultBlips[i].blip)}).addTo(Icons["Example"]).bindPopup(defaultBlips[i].name);
}

document.addEventListener("DOMContentLoaded", () => {
    const mapElement = document.querySelector('#map');
    if(mapElement != null && mapElement != undefined){
        if(mapElement.dataset.x != undefined){
            mymap.setView([mapElement.dataset.y,mapElement.dataset.x], 5)
            L.marker([mapElement.dataset.y,mapElement.dataset.x], {icon: customIcon(mapElement.dataset.icon)}).addTo(Icons["Example"]).bindPopup(mapElement.dataset.name);
        }
    }
});