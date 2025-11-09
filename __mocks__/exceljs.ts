class MockWorksheet {
  columns: any[] = [];
  rows: any[] = [];
  addRow(row: any) {
    this.rows.push(row);
  }
}

class MockWorkbook {
  worksheets: MockWorksheet[] = [];
  creator = '';
  created = new Date();

  addWorksheet() {
    const sheet = new MockWorksheet();
    this.worksheets.push(sheet);
    return sheet;
  }

  get xlsx() {
    return {
      writeBuffer: async () => Buffer.from('excel-buffer'),
    };
  }
}

const ExcelMock = {
  Workbook: MockWorkbook,
};

export default ExcelMock;
