
// Wait for document loaded (in jQuery)
$(document).ready(function() {

    // TinyMCE init
    tinymce.init({
        // Disable script-tags
        invalid_elements : "script",

        // Enable tinyMCE on id: post_text
        selector: '#post_text',
        branding: false,
        statusbar: false
    });

    const imgs = document.querySelectorAll('img.postimage');
    const fullPage = document.querySelector('#fullpage');

    const root = document.querySelector('body');

    imgs.forEach(img => {
        img.addEventListener('click', function() {
            fullPage.style.backgroundImage = 'url(' + img.src + ')';
            fullPage.style.display = 'flex';
          
            root.style.overflow = "hidden";
        });
    });

    fullPage.addEventListener('click', function() {
        fullPage.style.display = 'hidden';

        root.style.overflow = "auto";
    });


   /* var buttonPreview = document.getElementById("buttonPreview");
    var content = document.getElementById("contentText");
    
    buttonPreview.addEventListener("click", (e) => {
        console.log('preview text')
        var previewContent = document.getElementById("previewContent");

        previewContent.innerHTML = content.value;
    });*/
   
});


function readUrl(input) {
    if (input.files && input.files[0]) {
      let reader = new FileReader();

      reader.addEventListener('load', () => {
        let imgName = input.files[0].name;
        document.querySelector('.text-upload').classList.add("text-success");
        input.setAttribute("data-title", imgName);
      });

      reader.readAsDataURL(input.files[0]);
    }  
}

let selectInputs = document.querySelectorAll('.selectInput');
let buttonClose = document.querySelectorAll('.buttonClose');

buttonClose.forEach(function(e) {
    e.addEventListener('click', close);
});

selectInputs.forEach(function(e) {
    e.addEventListener('click', selector);
})

function selector(e) {
    let permissionDisplay = e.target.classList.add('d-none');
    let selector = e.target.nextSibling.nextSibling.classList.remove('d-none');
}

function close(e) {
    let displayPermission = e.target.parentNode.parentNode.parentNode.parentNode.parentNode.childNodes[1];
    let removeSelectOptions = e.target.parentNode.parentNode.parentNode.parentNode;  

    displayPermission.classList.remove('d-none');
    removeSelectOptions.classList.add('d-none');  
}

let modalMap = document.querySelectorAll('#openModal');

modalMap.forEach(function(e) {
    e.addEventListener('click', openModal);
});

var createdMap = null;
var marker = null;

function openModal(e) {

    let map = document.querySelector('#modal');
    map.style.display = "flex";

    const root = document.querySelector('body');
    root.style.overflow = "hidden";

    let mapModel = document.querySelector('.modal-block');

    mapModel.innerHTML = `<div class="headerModal"><div class="headerTitle">${e.currentTarget.dataset.name}</div></div>`;
    mapModel.innerHTML += '<div id="map" style="position: relative; width: 100%; height: 100%; border-radius: 10px;"></div>';

    createdMap = L.map('map', {
        crs: CUSTOM_CRS,
        minZoom: 2,
        maxZoom: 6,
        zoom: 5,
        maxNativeZoom: 0,
        preferCanvas: true,
        layers: [SateliteStyle, ExampleGroup],
        center: [0, 0],
        attributionControl: false,
        zoomControl: true,
        scrollWheelZoom: false,
    });

    createdMap.setView([e.currentTarget.dataset.y, e.currentTarget.dataset.x], 5)
    marker = L.marker([e.currentTarget.dataset.y, e.currentTarget.dataset.x], {icon: customIcon('mark')}).addTo(Icons["Example"]).bindPopup(e.currentTarget.dataset.name);

}


let closeM = document.querySelector('#closeModal');
closeM.addEventListener('click', closeModal);

function closeModal(e) {
    const root = document.querySelector('body');
    root.style.overflow = "auto";

    ExampleGroup.clearLayers()

    createdMap.off();
    createdMap.remove();

    let map = document.querySelector('#modal');
    map.style.display = "none";
}