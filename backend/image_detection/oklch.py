import numpy as np


def srgb_to_linear(rgb):
    rgb = np.asarray(rgb)
    return np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(linear):
    linear = np.asarray(linear)
    # Clamp negative values to 0 to avoid invalid power operations
    linear = np.maximum(linear, 0.0)
    return np.where(
        linear <= 0.0031308, linear * 12.92, 1.055 * (linear ** (1 / 2.4)) - 0.055
    )


def linear_rgb_to_oklab(rgb):
    M1 = np.array(
        [
            [0.4122214708, 0.5363325363, 0.0514459929],
            [0.2119034982, 0.6806995451, 0.1073969566],
            [0.0883024619, 0.2817188376, 0.6299787005],
        ]
    )
    lms = np.dot(rgb, M1.T)
    lms = np.cbrt(lms)
    M2 = np.array(
        [
            [0.2104542553, 0.7936177850, -0.0040720468],
            [1.9779984951, -2.4285922050, 0.4505937099],
            [0.0259040371, 0.7827717662, -0.8086757660],
        ]
    )
    return np.dot(lms, M2.T)


def oklab_to_linear_rgb(oklab):
    M1_inv = np.array(
        [
            [1.0000000, 0.3963378, 0.2158038],
            [1.0000000, -0.1055613, -0.0638542],
            [1.0000000, -0.0894842, -1.2914855],
        ]
    )
    lms = np.dot(oklab, M1_inv.T)
    lms = lms**3
    M2_inv = np.array(
        [
            [4.0767416621, -3.3077115913, 0.2309699292],
            [-1.2684380046, 2.6097574011, -0.3413193965],
            [-0.0041960863, -0.7034186147, 1.7076147010],
        ]
    )
    return np.dot(lms, M2_inv.T)


def oklab_to_oklch(oklab):
    L, a, b = oklab[..., 0], oklab[..., 1], oklab[..., 2]
    C = np.sqrt(a**2 + b**2)
    H = np.degrees(np.arctan2(b, a)) % 360
    return np.stack([L, C, H], axis=-1)


def oklch_to_oklab(oklch):
    L, C, H = oklch[..., 0], oklch[..., 1], oklch[..., 2]
    H_rad = np.radians(H)
    a = C * np.cos(H_rad)
    b = C * np.sin(H_rad)
    return np.stack([L, a, b], axis=-1)


def rgb_to_oklch(rgb):
    linear = srgb_to_linear(rgb)
    oklab = linear_rgb_to_oklab(linear)
    return oklab_to_oklch(oklab)


def oklch_to_rgb(oklch):
    oklab = oklch_to_oklab(oklch)
    linear = oklab_to_linear_rgb(oklab)
    return linear_to_srgb(linear)
