import pcbnew

def arrange_grid(ref_prefix="LED", start_num=1, pitch_mm=3.3, origin_x_mm=None, origin_y_mm=None):
    GRID_SIZE = 16

    board = pcbnew.GetBoard()

    pitch = pcbnew.FromMM(pitch_mm)

    # origin が未指定なら最初のフットプリントの現在位置を原点にする
    if origin_x_mm is None or origin_y_mm is None:
        first_ref = "{}{}".format(ref_prefix, start_num)
        first_fp = board.FindFootprintByReference(first_ref)
        if first_fp is None:
            print("Error: {} が見つかりません。origin を決定できません。".format(first_ref))
            return
        pos = first_fp.GetPosition()
        origin_x = pos.x if origin_x_mm is None else pcbnew.FromMM(origin_x_mm)
        origin_y = pos.y if origin_y_mm is None else pcbnew.FromMM(origin_y_mm)
        origin_x_mm = pcbnew.ToMM(origin_x)
        origin_y_mm = pcbnew.ToMM(origin_y)
    else:
        origin_x = pcbnew.FromMM(origin_x_mm)
        origin_y = pcbnew.FromMM(origin_y_mm)

    placed = 0
    missing = []

    for i in range(GRID_SIZE * GRID_SIZE):
        num = start_num + i
        ref = "{}{}".format(ref_prefix, num)

        fp = board.FindFootprintByReference(ref)
        if fp is None:
            missing.append(ref)
            continue

        row = i // GRID_SIZE
        col = i % GRID_SIZE

        x = origin_x + col * pitch
        y = origin_y + row * pitch

        fp.SetPosition(pcbnew.VECTOR2I(int(x), int(y)))

        # Reference, Valueフィールドを非表示にする
        for field in fp.GetFields():
            if field.GetName() in ("Reference", "Value"):
                field.SetVisible(False)

        placed += 1

    pcbnew.Refresh()

    print("=== arrange_grid ===")
    print("Prefix: {}, Start: {}, Pitch: {}mm".format(ref_prefix, start_num, pitch_mm))
    print("Origin: ({}, {})mm".format(origin_x_mm, origin_y_mm))
    print("Placed: {}/{}".format(placed, GRID_SIZE * GRID_SIZE))
    if missing:
        print("Missing: {}".format(", ".join(missing[:10])))
        if len(missing) > 10:
            print("  ... and {} more".format(len(missing) - 10))
