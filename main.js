import './style.css';
import {Map, View} from 'ol';
import VectorLayer from 'ol/layer/Vector';
import {fromLonLat, toLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';  
import apply from 'ol-mapbox-style';
import {Icon, Style} from 'ol/style';


const initialCenter = fromLonLat([8.259006, 46.825785]);
const initialZoom = 6.7;
const mapView = new View({
  center: initialCenter,
  zoom: initialZoom})
const currentZoom = mapView.getZoom()



let haltestellenAlle = new VectorLayer({
  source: new VectorSource({
    format: new GeoJSON(),
    url: 'Haltestellen.geojson'
  }),
  style: function zommrangeFromResolution(feature, resolution){
    const zoomLevel = map.getView().getZoomForResolution(resolution) 
    if(zoomLevel>=12 && feature.get("Verkehrsmittel_Bezeichnung") === 'Zug'){
      return new Style({
        image: new Icon({
          src : 'Icons/Icon_Train.png',
          width: currentZoom*1.5,
          height: currentZoom*1.5,
        })
      })
    } else if(zoomLevel>=14 && feature.get("Verkehrsmittel_Bezeichnung") != 'Zug'){
      return new Style({
        image: new Icon({
          src : 'Icons/Icon_Bus.png',
          width: currentZoom*1.5,
          height: currentZoom*1.5,
        })
      })
    } else{
      return new Style({})
    }
}})
haltestellenAlle.setZIndex(1)

let content = document.getElementById('searching');

const map = new Map({
  target: 'map',
  layers: [
    haltestellenAlle
  ],
  view: mapView
  })
//Die Funktion für die Berechnung der Zeitdifferenz zwischen jetzt und die nächste Abfahrt
function timeDifference(zeitInMS){
  let zeitInM = zeitInMS/60000
  let zeitInH = zeitInM/60
if(zeitInM<=60 && zeitInM > 1){
    return Math.floor(zeitInM) + ' Minuten'
  }else if(Math.floor(zeitInM) >= 0 && Math.floor(zeitInM) <= 1 ){
    return 'der Minute'
  }else if(Math.floor(zeitInM)<0){
    return 'wenige Momente mit ' + Math.abs(Math.floor(zeitInM)) + ' min. Verspätung'
  }
  else{
    zeitInM = Math.floor(zeitInM) - Math.floor(zeitInH) * 60
    return Math.floor(zeitInH) + ' Stunden und ' + zeitInM + ' Minuten'
  }
}


map.on('singleclick', function (evt) {
  const todayDate = new Date()
  let feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
    return feature;
  });
//Überprüft ob ein Feature geklickt wird
  if (feature && haltestellenAlle.getSource().hasFeature(feature)) {
    let haltestellenProperties = feature.getProperties()
    let stationName=haltestellenProperties.Name
    let stationCode = haltestellenProperties.Nummer
    let apiUrl = `https://transport.opendata.ch/v1/stationboard?station=${stationCode}&limit=10`
    async function fetchTimetable() {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error("Fehler beim Abrufen der Fahrplandaten");
      }
      const data = await response.json();
      return data.stationboard
    }

//Hier werden die Zeittabellen erstellt
    let zeitdaten =  fetchTimetable();
    zeitdaten.then(value =>  {
      if(value.length == 0){
        content.innerHTML = `<p id=errorNoStation>Für diese Station wurde keine Abfahrten gefunde.<br> Überprüfen sie ob sie von der SBB betrieben wird.<p>`
      }else{      
      zeitdaten = value

      let innerHTMLTimetable= ''
      for(let x=0;x<value.length; x++){
      let departureDate = new Date(zeitdaten[x].stop.departureTimestamp*1000)
      let abfahrtDifferenz = departureDate-todayDate
      innerHTMLTimetable = innerHTMLTimetable +
      `
      <div class=Verbindung id=Station${x}>Für ${zeitdaten[x].to}, Abfahrt in ${timeDifference(abfahrtDifferenz)}</div>
      `
      }
      content.innerHTML = 
      `
      <h1 class=searchingHeader>${stationName}
      <h2 class=searchingDepartures>Nächste Abfahrten:</h2>
      <div class = abfahrtstabelle>${innerHTMLTimetable}</div>
      `
//Die Zeittabelle wird erweitert so dass beim Klicken mehr Infos vorkommen
      const myTimetable = document.getElementsByClassName('Verbindung');
      Array.from(myTimetable).forEach(element => element.addEventListener('click', function(e){
        let open = element.classList.contains("open");

        if(open) {
          element.classList.remove("open")
          element.removeChild(element.querySelector("div.inner"));

          if(document.body.querySelectorAll("div.inner").length == 0) {
            document.body.classList.remove("open")
          }
        } else {
          document.body.classList.add("open")
          element.classList.add("open")

          let passingList = zeitdaten[Number(e.target.id.replace('Station', ''))].passList
          let dateDepartureStation = new Date(passingList[0].departureTimestamp * 1000)
          let dayDate = dateDepartureStation.getDate()
          let monthDate = dateDepartureStation.getMonth() + 1
          let hoursDate = dateDepartureStation.getHours()
          let minutesDate = dateDepartureStation.getMinutes()
          let delay = passingList[0].delay
          let innerHTMLPassing;
          innerHTMLPassing = `<div class="inner">`

          if(dayDate.toString().length == 1){
            dayDate = '0' + dayDate.toString()
          }

          if(monthDate.toString().length == 1){
            monthDate = '0' + monthDate.toString()
          }

          if(hoursDate.toString().length == 1){
            hoursDate = '0' + hoursDate.toString()
          }

          if(minutesDate.toString().length == 1){
            minutesDate = '0' + minutesDate.toString()
          }

          if(delay != 0){
            innerHTMLPassing += 
            `
            <p class=preciseTableInfos>${stationName} ---- ${dayDate}.${monthDate} ${hoursDate}:${minutesDate}<span class=delay> + ${delay}</span></p>          
            `  
          }else{innerHTMLPassing += 
            `
            <p class=preciseTableInfos>${stationName} ---- ${dayDate}.${monthDate} ${hoursDate}:${minutesDate}</p>          
            `}
  //Hier wird die Funktion geschrieben um die Stationenliste zu berechnen und darzustellen 
          for(let x=1; x<passingList.length;x++){
            let departureTime = new Date(passingList[x].departure)
            let stationName = passingList[x].station.name
            dayDate = departureTime.getDate()
            monthDate = departureTime.getMonth() + 1
            hoursDate = departureTime.getHours()
            minutesDate = departureTime.getMinutes()
            delay = passingList[x].delay

            if(dayDate.toString().length == 1){
              dayDate = '0' + dayDate.toString()
            }

            if(monthDate.toString().length == 1){
              monthDate = '0' + monthDate.toString()
            }

            if(hoursDate.toString().length == 1){
              hoursDate = '0' + hoursDate.toString()
            }

            if(minutesDate.toString().length == 1){
              minutesDate = '0' + minutesDate.toString()
            }
  //Hier wird die Funktion für die letzte Station der passing List 
            while(x==passingList.length-1){
              let arrivalTime = new Date(passingList[x].arrival)
              dayDate = arrivalTime.getDate()
              monthDate = arrivalTime.getMonth() + 1
              hoursDate = arrivalTime.getHours()
              minutesDate = arrivalTime.getMinutes()
              delay = passingList[x].delay
    
              if(dayDate.toString().length == 1){
                dayDate = '0' + dayDate.toString()
              }
    
              if(monthDate.toString().length == 1){
                monthDate = '0' + monthDate.toString()
              }
    
              if(hoursDate.toString().length == 1){
                hoursDate = '0' + hoursDate.toString()
              }
    
              if(minutesDate.toString().length == 1){
                minutesDate = '0' + minutesDate.toString()
              }
    
              if(delay != 0){
                innerHTMLPassing = innerHTMLPassing + 
                `
                <p class=preciseTableInfos>${stationName} ---- ${dayDate}.${monthDate} ${hoursDate}:${minutesDate}<span class=delay> + ${delay}</span></p>          
                `  
              }else{innerHTMLPassing = innerHTMLPassing + 
                `
                <p class=preciseTableInfos>${stationName} ---- ${dayDate}.${monthDate} ${hoursDate}:${minutesDate}</p>          
                `}
              x++
              this.innerHTML = this.innerHTML + innerHTMLPassing + `<div>`;
              return;
            }
  //Ab hier passiert die Schlaufe immer wieder bis es zur letzte Station kommt
            if(delay != 0){
              innerHTMLPassing +=  
              `
              <p class=preciseTableInfos>${stationName} ---- ${dayDate}.${monthDate} ${hoursDate}:${minutesDate}<span class=delay> + ${delay}</span></p>          
              `  
            }else{innerHTMLPassing += 
              `
              <p class=preciseTableInfos>${stationName} ---- ${dayDate}.${monthDate} ${hoursDate}:${minutesDate}</p>          
              `}
          }
        }
      }))
    }
    })  
 
  }
});

const styleJson = 'https://api.maptiler.com/maps/fc8c52a1-3886-49fa-b244-25e3e5d3dd4f/style.json?key=A6OgbJ7Zc6fb2G5wId2F'

apply(map, styleJson).then(() => {
  let count = 0;
  map.getLayers().forEach(layer => {
    if(count <=4) {
      layer.getSource().setAttributions([]);
    }
    count++;
  })

  haltestellenAlle.getSource().setAttributions('Gemacht von Yves Magne, Geomatiker, 4.Lehrjahr, GMK21, 30.01.2025')
})
