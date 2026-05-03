# 厦门地铁线路与站点数据
# 3条运营线路，77个站点，5个换乘站

LINES = {
    "1号线": {
        "color": "#FF6A00",
        "name_cn": "1号线",
        "stations": [
            "镇海路", "中山公园", "将军祠", "文灶", "湖滨东路",
            "莲坂", "莲花路口", "吕厝", "乌石浦", "塘边",
            "火炬园", "殿前", "高崎", "集美学村", "园博苑",
            "杏林", "杏锦路", "官任", "诚毅广场", "集美软件园",
            "集美大道", "天水路", "厦门北站", "岩内"
        ]
    },
    "2号线": {
        "color": "#0077C8",
        "name_cn": "2号线",
        "stations": [
            "五缘湾", "湿地公园", "五通", "两岸金融中心", "东宅",
            "观音山", "何厝", "软件园二期", "岭兜", "古地石",
            "蔡塘", "后埔", "江头", "吕厝", "育秀东路",
            "体育中心", "湖滨中路", "建业路", "邮轮中心", "海沧湾公园",
            "海沧商务中心", "海沧行政中心", "马青路", "翁角路", "新垵",
            "新阳大道", "东孚", "天竺山"
        ]
    },
    "3号线": {
        "color": "#E60012",
        "name_cn": "3号线",
        "stations": [
            "厦门火车站", "湖滨东路", "体育中心", "人才中心", "湖里公园",
            "华荣路", "火炬园", "创业桥", "安兜", "坂尚",
            "湖里创新园", "五缘湾", "体育会展", "东界", "洪坑",
            "林前", "鼓锣", "翔安市民公园", "浦边", "后村",
            "蔡厝"
        ]
    }
}

# 换乘站: {站名: [可换乘线路]}
TRANSFERS = {
    "吕厝":       ["1号线", "2号线"],
    "湖滨东路":   ["1号线", "3号线"],
    "火炬园":     ["1号线", "3号线"],
    "体育中心":   ["2号线", "3号线"],
    "五缘湾":     ["2号线", "3号线"],
}

# 构建辅助索引
def build_station_index():
    """返回 {站名: [所属线路列表]}"""
    idx = {}
    for line_name, info in LINES.items():
        for st in info["stations"]:
            if st not in idx:
                idx[st] = []
            idx[st].append(line_name)
    return idx

def build_adjacency():
    """构建邻接表 {(站名, 线路): [(邻站, 线路, 权重, 类型)]}
    类型: 'same' 同线移动, 'transfer' 换乘
    """
    adj = {}
    # 同线相邻关系
    for line_name, info in LINES.items():
        stations = info["stations"]
        for i, st in enumerate(stations):
            key = (st, line_name)
            if key not in adj:
                adj[key] = []
            if i > 0:
                adj[key].append((stations[i-1], line_name, 1, "same"))
            if i < len(stations) - 1:
                adj[key].append((stations[i+1], line_name, 1, "same"))

    # 换乘关系
    for st, lines in TRANSFERS.items():
        for l1 in lines:
            for l2 in lines:
                if l1 != l2:
                    adj[(st, l1)].append((st, l2, 0, "transfer"))

    return adj

STATION_INDEX = build_station_index()
ADJ = build_adjacency()
