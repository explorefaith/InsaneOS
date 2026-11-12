/* wallpaper_find.h — one entry of a wallpaper catalog (the motion catalog, and the web pictures' one). */
#ifndef INSANE_HW_WALLPAPER_FIND_H
#define INSANE_HW_WALLPAPER_FIND_H
#include <stddef.h>
/* The catalog entry of "<id> <variant>": 0 and the three outputs if it exists. The download url is
 * prefix + the entry's file, so only bases that start with prefix are accepted. */
int hw_wallpaper_find(const char *json, size_t n, const char *arg, const char *prefix, char *url, size_t un, char *sha, size_t sn, unsigned long long *size);
#endif
