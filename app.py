from flask import Flask, render_template, request, jsonify
from graph_algorithms import (
    bfs_fewest_transfers,
    dijkstra_shortest,
    compare_routes,
    format_route,
)
from metro_data import LINES, STATION_INDEX, TRANSFERS
from route_map import STATION_POSITIONS, STATION_COORDS, LINE_COLORS, LINE_ROUTES

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/stations")
def api_stations():
    """返回所有站点和线路信息"""
    return jsonify({
        "lines": {
            name: {
                "color": info["color"],
                "stations": info["stations"]
            }
            for name, info in LINES.items()
        },
        "transfers": TRANSFERS,
    })


@app.route("/api/map-data")
def api_map_data():
    """返回线路图绘制数据"""
    return jsonify({
        "positions": STATION_POSITIONS,
        "coords": STATION_COORDS,
        "colors": LINE_COLORS,
        "routes": LINE_ROUTES,
    })


@app.route("/api/query/shortest", methods=["POST"])
def api_shortest():
    """最短路径查询"""
    data = request.get_json()
    start = data.get("start", "").strip()
    end = data.get("end", "").strip()

    if not start or not end:
        return jsonify({"error": "请提供起始站和终点站"}), 400
    if start not in STATION_INDEX:
        return jsonify({"error": f"未找到站点: {start}"}), 404
    if end not in STATION_INDEX:
        return jsonify({"error": f"未找到站点: {end}"}), 404

    route = dijkstra_shortest(start, end)
    if not route:
        return jsonify({"error": "未找到可行路线"}), 404

    result = format_route(route)
    result["type"] = "最短路径"
    return jsonify(result)


@app.route("/api/query/fewest-transfers", methods=["POST"])
def api_fewest_transfers():
    """最少换乘查询"""
    data = request.get_json()
    start = data.get("start", "").strip()
    end = data.get("end", "").strip()

    if not start or not end:
        return jsonify({"error": "请提供起始站和终点站"}), 400
    if start not in STATION_INDEX:
        return jsonify({"error": f"未找到站点: {start}"}), 404
    if end not in STATION_INDEX:
        return jsonify({"error": f"未找到站点: {end}"}), 404

    route = bfs_fewest_transfers(start, end)
    if not route:
        return jsonify({"error": "未找到可行路线"}), 404

    result = format_route(route)
    result["type"] = "最少换乘"
    return jsonify(result)


@app.route("/api/query/compare", methods=["POST"])
def api_compare():
    """多方案对比"""
    data = request.get_json()
    start = data.get("start", "").strip()
    end = data.get("end", "").strip()

    if not start or not end:
        return jsonify({"error": "请提供起始站和终点站"}), 400
    if start not in STATION_INDEX:
        return jsonify({"error": f"未找到站点: {start}"}), 404
    if end not in STATION_INDEX:
        return jsonify({"error": f"未找到站点: {end}"}), 404

    routes = compare_routes(start, end)
    results = []
    for label, route in routes:
        r = format_route(route)
        r["type"] = label
        results.append(r)

    return jsonify({"routes": results})


@app.route("/api/query/all", methods=["POST"])
def api_all():
    """一次性返回所有查询结果"""
    data = request.get_json()
    start = data.get("start", "").strip()
    end = data.get("end", "").strip()

    if not start or not end:
        return jsonify({"error": "请提供起始站和终点站"}), 400
    if start not in STATION_INDEX:
        return jsonify({"error": f"未找到站点: {start}"}), 404
    if end not in STATION_INDEX:
        return jsonify({"error": f"未找到站点: {end}"}), 404

    result = {}

    route = dijkstra_shortest(start, end)
    if route:
        r = format_route(route)
        r["type"] = "最短路径"
        result["shortest"] = r

    route = bfs_fewest_transfers(start, end)
    if route:
        r = format_route(route)
        r["type"] = "最少换乘"
        result["fewest_transfers"] = r

    routes = compare_routes(start, end)
    result["compare"] = []
    for label, route in routes:
        r = format_route(route)
        r["type"] = label
        result["compare"].append(r)

    return jsonify(result)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)