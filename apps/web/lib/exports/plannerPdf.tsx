import {
  Circle,
  Document,
  Image,
  Page,
  Polyline,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

export interface PlannerPdfStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  routeDistanceKm: number;
  arrivalSoc: number;
  departureSoc: number;
  energyAddedKwh: number;
  chargingMinutes: number;
}

export interface PlannerPdfFerrySegment {
  name: string;
  distanceKm: number;
  durationSeconds: number;
}

export interface PlannerPdfData {
  routeLabel: string;
  startLabel: string;
  waypointLabels: string[];
  destinationLabel: string;

  distanceKm: number;
  durationSeconds: number;
  totalChargingMinutes: number;
  totalTravelSeconds: number;

  avgSpeedKmh: number;
  energyKwh: number;
  whPerKm: number;

  arrivalSoc: number;
  plannedArrivalSoc: number | null;
  targetArrivalSoc: number;

  chargingSiteCount: number;
  chargingPlanComplete: boolean;

  geometry: Array<[number, number]>;
  mapImageDataUrl?: string | null;
  ferrySegments: PlannerPdfFerrySegment[];
  recommendedChargingStops: PlannerPdfStop[];
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 34,
    paddingHorizontal: 30,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#171717",
    backgroundColor: "#ffffff",
  },

  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 3,
  },

  subtitle: {
    fontSize: 9,
    color: "#737373",
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 7,
  },

  routeInfo: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },

  routeLine: {
    flexDirection: "row",
    marginBottom: 3,
  },

  routeLabel: {
    width: 78,
    color: "#737373",
  },

  routeValue: {
    flexGrow: 1,
    fontWeight: "bold",
  },

  mapBox: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },

  mapHint: {
    fontSize: 7,
    color: "#a3a3a3",
    marginTop: 4,
  },

  mapImage: {
    width: 515,
    height: 190,
    objectFit: "cover",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  metricCard: {
    width: 168,
    minHeight: 54,
    borderWidth: 1,
    borderTopWidth: 3,
    borderColor: "#e5e5e5",
    borderRadius: 7,
    padding: 8,
    marginRight: 7,
    marginBottom: 7,
  },

  metricLabel: {
    fontSize: 7.5,
    color: "#737373",
    marginBottom: 5,
  },

  metricValue: {
    fontSize: 14,
    fontWeight: "bold",
  },

  metricHint: {
    marginTop: 3,
    fontSize: 7,
    color: "#a3a3a3",
  },

  ferryBox: {
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 7,
    padding: 8,
    marginBottom: 6,
    backgroundColor: "#fffbeb",
  },

  stopCard: {
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 8,
    padding: 9,
    marginBottom: 8,
    backgroundColor: "#fffbeb",
  },

  stopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },

  stopNumber: {
    fontSize: 7,
    color: "#b45309",
    marginBottom: 2,
  },

  stopName: {
    fontSize: 10,
    fontWeight: "bold",
  },

  stopDuration: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#b45309",
  },

  stopMetrics: {
    flexDirection: "row",
  },

  stopMetric: {
    width: 98,
    marginRight: 6,
  },

  stopMetricLabel: {
    fontSize: 6.5,
    color: "#a3a3a3",
    marginBottom: 2,
  },

  stopMetricValue: {
    fontSize: 8.5,
    fontWeight: "bold",
  },

  note: {
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    fontSize: 7.5,
    color: "#737373",
  },

  footer: {
    position: "absolute",
    bottom: 14,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: "#a3a3a3",
  },
});

function duration(seconds: number): string {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

function createNumberFormatter(locale: string) {
  return new Intl.NumberFormat(
    locale.startsWith("de") ? "de-DE" : "en-US",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    },
  );
}

function labels(locale: string) {
  const de = locale.startsWith("de");

  return de
    ? {
        title: "DriveChronik Routenplanung",
        generated: "Erstellt",
        selectedRoute: "Ausgewählte Route",
        start: "Start",
        waypoints: "Zwischenziele",
        destination: "Ziel",
        routeOverview: "Routenübersicht",
        routeOverviewHint:
          "Schematische Darstellung der berechneten Route und Ladestopps.",
        summary: "Reiseübersicht",
        distance: "Distanz",
        driveTime: "Reisezeit ohne Laden",
        chargeTime: "Ladezeit",
        totalTime: "Gesamtreisezeit",
        avgSpeed: "Durchschnittstempo",
        consumption: "Verbrauch",
        arrivalNoCharge: "Ankunft ohne Laden",
        plannedArrival: "Geplanter Ankunfts-SoC",
        chargers: "Schnelllader im 15-km-Suchkorridor",
        includingFerry: "inklusive möglicher Fährpassagen",
        chargingStopsCount: "geplante Ladestopps",
        whPerKm: "Wh/km",
        ferries: "Fährpassagen",
        chargingStops: "Geplante Ladestopps",
        chargingStop: "Ladestopp",
        afterStart: "nach Start",
        arrival: "Ankunft",
        departure: "Weiterfahrt",
        energy: "Nachladen",
        chargingDuration: "Ladezeit",
        reserve: (target: number) =>
          `Berechnet für eine Zielreserve von ${Math.round(target)} % und mindestens 10 % bei Ankunft an einem Schnelllader.`,
        incomplete:
          "Hinweis: Die Ladeplanung konnte nicht vollständig abgeschlossen werden.",
        page: "Seite",
      }
    : {
        title: "DriveChronik Route Plan",
        generated: "Generated",
        selectedRoute: "Selected route",
        start: "Start",
        waypoints: "Waypoints",
        destination: "Destination",
        routeOverview: "Route overview",
        routeOverviewHint:
          "Schematic view of the calculated route and charging stops.",
        summary: "Trip overview",
        distance: "Distance",
        driveTime: "Travel time without charging",
        chargeTime: "Charging time",
        totalTime: "Total travel time",
        avgSpeed: "Average speed",
        consumption: "Consumption",
        arrivalNoCharge: "Arrival without charging",
        plannedArrival: "Planned arrival SoC",
        chargers: "Fast chargers in 15 km corridor",
        includingFerry: "including possible ferry passages",
        chargingStopsCount: "planned charging stops",
        whPerKm: "Wh/km",
        ferries: "Ferry passages",
        chargingStops: "Planned charging stops",
        chargingStop: "Charging stop",
        afterStart: "after start",
        arrival: "Arrival",
        departure: "Departure",
        energy: "Energy added",
        chargingDuration: "Charging time",
        reserve: (target: number) =>
          `Calculated for a ${Math.round(target)}% destination reserve and at least 10% on arrival at a fast charger.`,
        incomplete:
          "Note: The charging plan could not be completed.",
        page: "Page",
      };
}

function createProjector(
  geometry: Array<[number, number]>,
  width: number,
  height: number,
) {
  const padding = 13;

  const lats = geometry.map(([lat]) => lat);
  const lons = geometry.map(([, lon]) => lon);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const lonSpan = Math.max(maxLon - minLon, 0.0001);

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const scale = Math.min(
    usableWidth / lonSpan,
    usableHeight / latSpan,
  );

  const usedWidth = lonSpan * scale;
  const usedHeight = latSpan * scale;

  const offsetX = (width - usedWidth) / 2;
  const offsetY = (height - usedHeight) / 2;

  return ([lat, lon]: [number, number]): [number, number] => [
    offsetX + (lon - minLon) * scale,
    height - (offsetY + (lat - minLat) * scale),
  ];
}

function MetricCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <View
      style={[styles.metricCard, { borderTopColor: accent }]}
      wrap={false}
    >
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </View>
  );
}

function RouteGraphic({
  data,
  hint,
}: {
  data: PlannerPdfData;
  hint: string;
}) {
  if (data.mapImageDataUrl) {
    return (
      <View style={styles.mapBox} wrap={false}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image
          src={data.mapImageDataUrl}
          style={styles.mapImage}
        />
      </View>
    );
  }

  if (data.geometry.length < 2) {
    return null;
  }

  const width = 515;
  const height = 150;
  const project = createProjector(data.geometry, width, height);

  const routePoints = data.geometry
    .map((point) => {
      const [x, y] = project(point);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const start = project(data.geometry[0]);
  const destination = project(
    data.geometry[data.geometry.length - 1],
  );

  return (
    <View style={styles.mapBox} wrap={false}>
      <Svg width={width} height={height}>
        <Polyline
          points={routePoints}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2.6}
        />

        <Circle
          cx={start[0]}
          cy={start[1]}
          r={5}
          fill="#2563eb"
          stroke="#ffffff"
          strokeWidth={1.5}
        />

        {data.recommendedChargingStops.map((stop) => {
          const [x, y] = project([stop.lat, stop.lon]);

          return (
            <Circle
              key={stop.id}
              cx={x}
              cy={y}
              r={5}
              fill="#f59e0b"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          );
        })}

        <Circle
          cx={destination[0]}
          cy={destination[1]}
          r={5}
          fill="#10b981"
          stroke="#ffffff"
          strokeWidth={1.5}
        />
      </Svg>

      <Text style={styles.mapHint}>{hint}</Text>
    </View>
  );
}

function PlannerPdfDocument({
  data,
  locale,
}: {
  data: PlannerPdfData;
  locale: string;
}) {
  const t = labels(locale);
  const nf = createNumberFormatter(locale);

  const generatedAt = new Intl.DateTimeFormat(
    locale.startsWith("de") ? "de-DE" : "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date());

  const plannedArrival =
    data.plannedArrivalSoc != null
      ? `${Math.max(0, Math.round(data.plannedArrivalSoc))} %`
      : "-";

  return (
    <Document title={t.title} author="DriveChronik">
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>{t.title}</Text>

        <Text style={styles.subtitle}>
          {t.generated}: {generatedAt}
        </Text>

        <View style={styles.routeInfo} wrap={false}>
          {data.routeLabel ? (
            <View style={styles.routeLine}>
              <Text style={styles.routeLabel}>
                {t.selectedRoute}
              </Text>
              <Text style={styles.routeValue}>
                {data.routeLabel}
              </Text>
            </View>
          ) : null}

          <View style={styles.routeLine}>
            <Text style={styles.routeLabel}>{t.start}</Text>
            <Text style={styles.routeValue}>
              {data.startLabel || "-"}
            </Text>
          </View>

          {data.waypointLabels.length > 0 ? (
            <View style={styles.routeLine}>
              <Text style={styles.routeLabel}>
                {t.waypoints}
              </Text>
              <Text style={styles.routeValue}>
                {data.waypointLabels.join("  |  ")}
              </Text>
            </View>
          ) : null}

          <View style={styles.routeLine}>
            <Text style={styles.routeLabel}>
              {t.destination}
            </Text>
            <Text style={styles.routeValue}>
              {data.destinationLabel || "-"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {t.routeOverview}
        </Text>

        <RouteGraphic
          data={data}
          hint={t.routeOverviewHint}
        />

        <Text style={styles.sectionTitle}>{t.summary}</Text>

        <View style={styles.grid}>
          <MetricCard
            label={t.distance}
            value={`${nf.format(data.distanceKm)} km`}
            accent="#3b82f6"
          />

          <MetricCard
            label={t.driveTime}
            value={duration(data.durationSeconds)}
            hint={t.includingFerry}
            accent="#8b5cf6"
          />

          <MetricCard
            label={t.chargeTime}
            value={duration(data.totalChargingMinutes * 60)}
            hint={`${data.recommendedChargingStops.length} ${t.chargingStopsCount}`}
            accent="#f59e0b"
          />

          <MetricCard
            label={t.totalTime}
            value={duration(data.totalTravelSeconds)}
            accent="#6366f1"
          />

          <MetricCard
            label={t.avgSpeed}
            value={`${Math.round(data.avgSpeedKmh)} km/h`}
            accent="#0ea5e9"
          />

          <MetricCard
            label={t.consumption}
            value={`${nf.format(data.energyKwh)} kWh`}
            hint={`${Math.round(data.whPerKm)} ${t.whPerKm}`}
            accent="#06b6d4"
          />

          <MetricCard
            label={t.arrivalNoCharge}
            value={`${Math.max(0, Math.round(data.arrivalSoc))} %`}
            accent="#f43f5e"
          />

          <MetricCard
            label={t.plannedArrival}
            value={plannedArrival}
            accent="#10b981"
          />

          <MetricCard
            label={t.chargers}
            value={String(data.chargingSiteCount)}
            accent="#0ea5e9"
          />
        </View>

        {data.ferrySegments.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>
              {t.ferries}
            </Text>

            {data.ferrySegments.map((ferry, index) => (
              <View
                key={`${ferry.name}-${index}`}
                style={styles.ferryBox}
                wrap={false}
              >
                <Text style={{ fontWeight: "bold" }}>
                  {ferry.name}
                </Text>
                <Text style={{ marginTop: 3 }}>
                  {nf.format(ferry.distanceKm)} km -{" "}
                  {duration(ferry.durationSeconds)}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {data.recommendedChargingStops.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>
              {t.chargingStops}
            </Text>

            {data.recommendedChargingStops.map(
              (stop, index) => (
                <View
                  key={stop.id}
                  style={styles.stopCard}
                  wrap={false}
                >
                  <View style={styles.stopHeader}>
                    <View>
                      <Text style={styles.stopNumber}>
                        {t.chargingStop} {index + 1}
                      </Text>
                      <Text style={styles.stopName}>
                        {stop.name}
                      </Text>
                    </View>

                    <Text style={styles.stopDuration}>
                      {duration(stop.chargingMinutes * 60)}
                    </Text>
                  </View>

                  <View style={styles.stopMetrics}>
                    <View style={styles.stopMetric}>
                      <Text style={styles.stopMetricLabel}>
                        {t.afterStart}
                      </Text>
                      <Text style={styles.stopMetricValue}>
                        {nf.format(stop.routeDistanceKm)} km
                      </Text>
                    </View>

                    <View style={styles.stopMetric}>
                      <Text style={styles.stopMetricLabel}>
                        {t.arrival}
                      </Text>
                      <Text style={styles.stopMetricValue}>
                        {Math.round(stop.arrivalSoc)} %
                      </Text>
                    </View>

                    <View style={styles.stopMetric}>
                      <Text style={styles.stopMetricLabel}>
                        {t.departure}
                      </Text>
                      <Text style={styles.stopMetricValue}>
                        {Math.round(stop.departureSoc)} %
                      </Text>
                    </View>

                    <View style={styles.stopMetric}>
                      <Text style={styles.stopMetricLabel}>
                        {t.energy}
                      </Text>
                      <Text style={styles.stopMetricValue}>
                        {nf.format(stop.energyAddedKwh)} kWh
                      </Text>
                    </View>

                    <View style={styles.stopMetric}>
                      <Text style={styles.stopMetricLabel}>
                        {t.chargingDuration}
                      </Text>
                      <Text style={styles.stopMetricValue}>
                        {Math.round(stop.chargingMinutes)} min
                      </Text>
                    </View>
                  </View>
                </View>
              ),
            )}
          </>
        ) : null}

        <Text style={styles.note}>
          {t.reserve(data.targetArrivalSoc)}
          {!data.chargingPlanComplete
            ? ` ${t.incomplete}`
            : ""}
        </Text>

        <View style={styles.footer} fixed>
          <Text>DriveChronik</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${t.page} ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderPlannerPdf(
  data: PlannerPdfData,
  locale: string,
): Promise<Buffer> {
  return renderToBuffer(
    <PlannerPdfDocument data={data} locale={locale} />,
  );
}
