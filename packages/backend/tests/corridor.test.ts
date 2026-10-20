import { corridorService } from '../src/modules/routing/corridor.service';

describe('Smart Corridor Routing Service', () => {
  it('debe calcular coordenadas de ruta entre dos puntos geográficos (OSRM/Fallback)', async () => {
    const origin = { latitude: 6.2085, longitude: -75.5678 }; // El Poblado
    const destination = { latitude: 6.2518, longitude: -75.5636 }; // Centro

    const route = await corridorService.getRouteGeometry(origin, destination);

    expect(route).toHaveProperty('coordinates');
    expect(route.coordinates.length).toBeGreaterThanOrEqual(2);
    expect(route.distanceMeters).toBeGreaterThan(0);
    expect(route.durationSeconds).toBeGreaterThan(0);
  });
});
