from collections import deque
import heapq
from metro_data import ADJ, TRANSFERS, STATION_INDEX, LINES


def bfs_fewest_transfers(start_station, end_station):
    """BFS 最少换乘 — 在 (站名, 线路) 状态空间搜索。
    换乘边代价=1，同线移动代价=0。返回路线列表或 None。
    """
    start_states = [(start_station, ln) for ln in STATION_INDEX.get(start_station, [])]
    if not start_states:
        return None

    # 统一用双端队列做 0-1 BFS（appendleft 用于零权边）
    q = deque()
    visited = {}
    parent = {}

    for s in start_states:
        q.append(s)
        visited[s] = 0
        parent[s] = None

    end_state = None

    while q:
        cur = q.popleft()
        cur_st, cur_line = cur
        cost = visited[cur]

        if cur_st == end_station:
            end_state = cur
            break

        for nbr_st, nbr_line, weight, _ in ADJ.get(cur, []):
            nbr = (nbr_st, nbr_line)
            new_cost = cost + weight
            if nbr not in visited or new_cost < visited[nbr]:
                visited[nbr] = new_cost
                parent[nbr] = cur
                if weight == 0:
                    q.appendleft(nbr)
                else:
                    q.append(nbr)

    if end_state is None:
        return None

    # 回溯路径
    return _reconstruct_path(parent, end_state)


def dijkstra_shortest(start_station, end_station):
    """Dijkstra 最短路径 — 每站权 1，换乘 0。返回路线列表或 None。"""
    start_states = [(start_station, ln) for ln in STATION_INDEX.get(start_station, [])]
    if not start_states:
        return None

    pq = []
    dist = {}
    parent = {}
    transfers = {}

    for s in start_states:
        dist[s] = 1   # 包含起点站自身
        transfers[s] = 0
        parent[s] = None
        heapq.heappush(pq, (1, 0, s))

    end_state = None

    while pq:
        d, tr, cur = heapq.heappop(pq)
        cur_st, cur_line = cur

        if d > dist.get(cur, float("inf")):
            continue

        if cur_st == end_station:
            end_state = cur
            break

        for nbr_st, nbr_line, weight, etype in ADJ.get(cur, []):
            nbr = (nbr_st, nbr_line)
            nd = d + weight
            ntr = tr + (1 if etype == "transfer" else 0)

            if nd < dist.get(nbr, float("inf")) or \
               (nd == dist.get(nbr, float("inf")) and ntr < transfers.get(nbr, float("inf"))):
                dist[nbr] = nd
                transfers[nbr] = ntr
                parent[nbr] = cur
                heapq.heappush(pq, (nd, ntr, nbr))

    if end_state is None:
        return None

    return _reconstruct_path(parent, end_state)


def compare_routes(start_station, end_station):
    """多方案对比 — 返回最多 3 条不同路线。
    策略: 直接跑 Dijkstra 得到最优，再枚举经过另外换乘站的备选方案。
    """
    routes = []
    seen = set()

    # 方案 1: 直接 Dijkstra 最优
    r1 = dijkstra_shortest(start_station, end_station)
    if r1:
        routes.append(("最优路径", r1))
        seen.add(_route_sig(r1))

    # 方案 2-3: 枚举必经换乘站
    for ts in TRANSFERS:
        if ts == start_station or ts == end_station:
            continue
        seg1 = dijkstra_shortest(start_station, ts)
        if not seg1:
            continue
        seg2 = dijkstra_shortest(ts, end_station)
        if not seg2:
            continue
        # 拼接（去重叠的换乘站）
        combined = seg1[:-1] + seg2
        sig = _route_sig(combined)
        if sig not in seen:
            seen.add(sig)
            routes.append((f"经{ts}", combined))

        if len(routes) >= 3:
            break

    # 按站数排序
    routes.sort(key=lambda x: len(x[1]))
    return routes


def _reconstruct_path(parent, end_state):
    """从 parent 字典回溯路径，返回 [(站名, 线路), ...]"""
    path = []
    cur = end_state
    while cur is not None:
        path.append(cur)
        cur = parent.get(cur)
    path.reverse()
    return path


def _route_sig(route):
    """生成路线签名用于去重"""
    return tuple(st for st, _ in route)


def format_route(route):
    """将内部路径转为可读结果。

    返回 {
        "stations": [站名列表],
        "transfers": [{"station": 站名, "from": 线路, "to": 线路}],
        "total_stations": int,
        "total_transfers": int,
        "description": str,
    }
    """
    if not route:
        return None

    station_list = []
    transfer_list = []
    prev_line = route[0][1]
    station_count = 0

    for i, (st, ln) in enumerate(route):
        if i == 0:
            station_list.append(st)
        elif st != route[i-1][0]:
            station_list.append(st)
            station_count += 1

        if ln != prev_line:
            transfer_list.append({
                "station": st,
                "from": prev_line,
                "to": ln
            })
            prev_line = ln

    total_stations = len(station_list)
    if total_stations == 0:
        total_stations = 1

    desc = " -> ".join(station_list)
    if transfer_list:
        desc += f" (换乘{len(transfer_list)}次)"
    else:
        desc += " (无需换乘)"

    return {
        "stations": station_list,
        "transfers": transfer_list,
        "total_stations": total_stations,
        "total_transfers": len(transfer_list),
        "description": desc,
    }
