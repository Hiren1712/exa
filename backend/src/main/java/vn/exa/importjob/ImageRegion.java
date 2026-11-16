package vn.exa.importjob;

public record ImageRegion(int page, int x, int y, int width, int height) {
    public boolean isValidForPages(int pageCount) {
        return page >= 1 && page <= pageCount
                && x >= 0 && y >= 0
                && width > 0 && height > 0
                && x + (long) width <= 1000
                && y + (long) height <= 1000;
    }
}
