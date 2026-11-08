# Global View · assets

- Three.js 0.179.1 (including OrbitControls) and Leaflet 1.9.4, MIT and BSD-2-Clause respectively. The OrbitControls module import points to the local Three.js distribution.
- TopoJSON Client 3.1.0, ISC. World Atlas 2.0.2 `countries-50m.json`, derived from Natural Earth (public-domain geography).
- Natural Earth 5.1.2 `ne_10m_populated_places_simple` with names, countries and city-centre coordinates, stored in compact form. Map resolution is regional, without local street details.
- Earth textures from the Three Globe sample images `earth-blue-marble.jpg` and `earth-night.jpg`, based on NASA imagery and encoded as WebP.

All renderer files and geographic data are served under `/test/global-view/`. Opening the route view does not send shipment addresses to an external geocoder. The local city index resolves supported city names and explicitly supplied coordinates. The renderer does not calculate transport paths.
