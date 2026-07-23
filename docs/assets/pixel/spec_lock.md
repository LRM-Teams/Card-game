# Execution Lock — v2 Production

## canvas
- base_size: 64x64
- tile_size: 64x64
- format: RGBA PNG

## palette
- name: doudizhu-gold-green-v2
- colors:
  - #0B2218
  - #14352A
  - #1B4A37
  - #1F5540
  - #2A6349
  - #1C1C1C
  - #2E8B57
  - #344052
  - #232C38
  - #3A5A78
  - #6496C8
  - #5A2218
  - #6E1A1F
  - #3D1018
  - #1C0C14
  - #6B4424
  - #8A5C34
  - #4A2E18
  - #8A3424
  - #8A2218
  - #33221A
  - #43301F
  - #241612
  - #A82020
  - #7A0F10
  - #D63031
  - #B8C4D4
  - #C48A14
  - #C49218
  - #960000
  - #E0B83A
  - #E8BC3A
  - #F0D06A
  - #F3DF9A
  - #FBFBF6
  - #FFF3C4
  - #FFFCF7
  - #F3EEE3
  - #E8DFD0
  - #C9B89A
  - #8A7355
  - #FFE08A
  - #B48250

## style
- sub_style: cel-shaded
- outline_color: #1C1C1C
- shading: 3-tone
- dithering: none
- light_direction: top-left

## per_sprite_budget
- max_colors: 31

## assets
- tiles:
  - name: felt_texture
    size: 64x64
  - name: rail_texture
    size: 64x64
- backgrounds:
  - name: room_bg
    size: 320x180
  - name: lobby_hero
    size: 360x160
  - name: table_vignette
    size: 128x72
  - name: room_corner_ornament
    size: 32x32
- ui:
  - name: card_front_template
    size: 104x148
  - name: card_back
    size: 104x148
  - name: joker_small
    size: 104x148
  - name: joker_big
    size: 104x148
  - name: card_small_front
    size: 40x56
  - name: card_small_back
    size: 40x56
  - name: badge_landlord
    size: 28x28
  - name: badge_farmer
    size: 24x24
  - name: btn_primary
    size: 120x40
  - name: btn_primary_normal
    size: 120x40
  - name: btn_primary_pressed
    size: 120x40
  - name: btn_primary_disabled
    size: 120x40
  - name: btn_secondary_normal
    size: 96x36
  - name: btn_secondary_pressed
    size: 96x36
  - name: btn_secondary_disabled
    size: 96x36
  - name: btn_pass_normal
    size: 72x36
  - name: btn_pass_pressed
    size: 72x36
  - name: double_badge
    size: 60x60
  - name: timer_ring
    size: 48x48
  - name: timer_ring_critical
    size: 48x48
  - name: mult_hud_bg
    size: 80x24
  - name: phase_label_bg
    size: 80x24
  - name: victory_badge
    size: 120x120
  - name: defeat_badge
    size: 120x120
  - name: settle_coin
    size: 24x24
  - name: settle_panel_win
    size: 200x120
  - name: avatar_frame_landlord
    size: 64x64
  - name: avatar_frame_farmer
    size: 64x64
  - name: avatar_frame_default
    size: 64x64
  - name: seat_turn_ring
    size: 56x56
  - name: seat_idle_ring
    size: 56x56
- characters:
  - name: landlord_character
    size: 128x128
  - name: farmer_character
    size: 128x128
- effects:
  - name: bomb
    size: 96x96
  - name: spring
    size: 96x72
  - name: rocket
    size: 96x96
  - name: bomb_flash
    size: 64x64
  - name: turn_pulse
    size: 64x64

## forbidden
- Anti-aliasing
- Partial opacity (1-254 alpha)
- Colors outside declared palette
